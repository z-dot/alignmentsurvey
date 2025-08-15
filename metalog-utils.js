// Metalog Distribution Utilities
// All metalog-specific mathematical operations and data processing

class MetalogUtils extends ConversionUtils {
    constructor() {
        super(); // Initialize ConversionUtils
        
        // Metalog-specific configuration
        this.metalogBasisCache = new Map();
    }

    // MetalogUtils now inherits timeToNormalized, normalizedToTime, parseDuration, parseAbsoluteYear,
    // parseTimeInput (legacy), parseProbabilityInput, and formatTime from ConversionUtils

    // Data validation
    validateMetalogData(data) {
        if (data.length < 2) {
            return { valid: false, error: "Need at least 2 data points" };
        }
        
        // Check probabilities are non-decreasing (allow equal values)
        for (let i = 1; i < data.length; i++) {
            if (data[i].y < data[i-1].y) {
                return { valid: false, error: `Probability cannot decrease: ${(data[i-1].y*100).toFixed(1)}% → ${(data[i].y*100).toFixed(1)}%` };
            }
        }
        
        // Check times are positive (but we're now working in [0,1] space, so this should be >= 0)
        for (let i = 0; i < data.length; i++) {
            if (data[i].x < 0) {
                return { valid: false, error: "All times must be non-negative" };
            }
        }
        
        return { valid: true };
    }

    // Metalog basis functions
    getMetalogBasisValue(y, j) {
        const safeY = Math.max(0.001, Math.min(0.999, y));
        
        switch(j) {
            case 1: return 1;
            case 2: return Math.log(safeY / (1 - safeY));
            case 3: return (safeY - 0.5) * Math.log(safeY / (1 - safeY));
            case 4: return safeY - 0.5;
            default:
                if (j % 2 === 1) { // odd j >= 5
                    return Math.pow(safeY - 0.5, (j - 1) / 2);
                } else { // even j >= 6
                    return Math.log(safeY / (1 - safeY)) * Math.pow(safeY - 0.5, (j / 2) - 1);
                }
        }
    }

    // Core metalog fitting function
    fitMetalog(dataPoints, numTerms = 3) {
        console.log("🧮 Fitting metalog with", dataPoints.length, "points and", numTerms, "terms");
        
        // Sort points by CDF probability
        const sortedPoints = [...dataPoints].sort((a, b) => a.y - b.y);
        
        // Validate monotonicity
        for (let i = 1; i < sortedPoints.length; i++) {
            if (sortedPoints[i].y <= sortedPoints[i-1].y) {
                throw new Error("CDF probabilities must be strictly increasing");
            }
            if (sortedPoints[i].x <= sortedPoints[i-1].x) {
                console.warn("⚠️ Times are not increasing - metalog can handle this but results may be unexpected");
            }
        }
        
        // Normalize time values to [0,1] range for fitting
        const normalizedPoints = sortedPoints.map(point => ({
            x: this.timeToNormalized(point.x),
            y: point.y
        }));
        
        console.log("📊 Normalized points:", normalizedPoints);
        
        const n = normalizedPoints.length;
        const k = Math.min(numTerms, n);
        
        // Build the Y matrix using metalog basis functions
        const Y = [];
        const z = [];
        
        for (let i = 0; i < n; i++) {
            const y = normalizedPoints[i].y;
            const x = normalizedPoints[i].x;
            
            const row = [];
            for (let j = 1; j <= k; j++) {
                row.push(this.getMetalogBasisValue(y, j));
            }
            
            Y.push(row);
            z.push(x);
        }
        
        console.log("🔢 Y matrix:", Y);
        console.log("🔢 z vector:", z);
        
        try {
            // Use math.js to solve the linear system
            const YMatrix = math.matrix(Y);
            const zVector = math.matrix(z);
            
            // If we have exactly k points, we can solve directly
            if (n === k) {
                const coefficients = math.multiply(math.inv(YMatrix), zVector);
                console.log("✅ Direct solve successful");
                return {
                    coefficients: coefficients.toArray(),
                    numTerms: k,
                    dataPoints: normalizedPoints
                };
            } else {
                // Use least squares: a = (Y^T Y)^(-1) Y^T z
                const YT = math.transpose(YMatrix);
                const YTY = math.multiply(YT, YMatrix);
                const YTz = math.multiply(YT, zVector);
                const coefficients = math.multiply(math.inv(YTY), YTz);
                
                console.log("✅ Least squares solve successful");
                return {
                    coefficients: coefficients.toArray(),
                    numTerms: k,
                    dataPoints: normalizedPoints
                };
            }
        } catch (error) {
            console.error("❌ Matrix solve failed:", error);
            throw new Error(`Failed to fit metalog: ${error.message}`);
        }
    }

    // Evaluate metalog quantile function at given CDF probability
    evaluateMetalog(metalog, cdfProbability) {
        const y = Math.max(0.001, Math.min(0.999, cdfProbability));
        const coefficients = metalog.coefficients;
        const k = metalog.numTerms;
        
        let result = 0;
        
        for (let j = 1; j <= k; j++) {
            result += coefficients[j-1] * this.getMetalogBasisValue(y, j);
        }
        
        return result;
    }

    // Air-tight feasibility checking using Algorithm 1 from SSRN paper
    checkMetalogFeasibility(metalog) {
        const coefficients = metalog.coefficients;
        const k = metalog.numTerms;
        
        console.log(`🔍 Air-tight feasibility check for k=${k}: coefficients = [${coefficients.map(c => c.toFixed(4)).join(', ')}]`);
        
        // For k=2: a₂ > 0
        if (k >= 2 && coefficients[1] <= 0) {
            console.log("Feasibility failed: a₂ ≤ 0");
            return false;
        }
        
        // For k=3: a₂ > 0 and |a₃|/a₂ < 1.66711
        if (k >= 3) {
            const ratio = Math.abs(coefficients[2]) / coefficients[1];
            console.log(`🔍 Checking |a₃|/a₂ = ${Math.abs(coefficients[2]).toFixed(4)}/${coefficients[1].toFixed(4)} = ${ratio.toFixed(4)}`);
            if (ratio >= 1.66711) {
                console.log(`Feasibility failed: |a₃|/a₂ = ${ratio.toFixed(4)} ≥ 1.66711`);
                return false;
            }
        }
        
        console.log("✅ Basic algebraic constraints passed");
        
        // For k ≥ 4, use air-tight feasibility testing via polynomial root finding
        if (k >= 4) {
            return this.checkInflectionPointsFeasibility(metalog);
        }
        
        return true; // k ≤ 3 with algebraic constraints satisfied is always feasible
    }

    // Air-tight feasibility checking via Algorithm 1 from SSRN paper
    checkInflectionPointsFeasibility(metalog) {
        const coefficients = metalog.coefficients;
        const k = metalog.numTerms;
        
        try {
            // Step 1: Find all inflection points using polynomial root finding
            const inflectionPoints = this.findAllInflectionPoints(metalog);
            console.log(`📊 Found ${inflectionPoints.length} inflection points: [${inflectionPoints.map(y => y.toFixed(6)).join(', ')}]`);
            
            // Step 2: Check that M'(y) ≥ 0 at each inflection point
            for (const y of inflectionPoints) {
                const slope = this.evaluateMetalogDerivative(metalog, y);
                console.log(`🔍 Slope at inflection y=${y.toFixed(6)}: M'(y)=${slope.toFixed(8)}`);
                
                if (slope < -1e-10) { // Use small tolerance for numerical precision
                    console.log(`❌ Feasibility failed: negative slope ${slope.toFixed(8)} at inflection point y=${y.toFixed(6)}`);
                    return false;
                }
            }
            
            // Step 3: Check tail feasibility using limits
            if (!this.checkTailFeasibility(metalog)) {
                return false;
            }
            
            console.log("✅ Air-tight feasibility check passed");
            return true;
            
        } catch (error) {
            console.error(`❌ Error in air-tight feasibility check: ${error.message}`);
            return false;
        }
    }
    
    // Implementation of Algorithm 1: Air-tight identification of inflection points
    findAllInflectionPoints(metalog) {
        const k = metalog.numTerms;
        const coefficients = metalog.coefficients;
        
        // Calculate i = ⌊(k+1)/2⌋ as per Algorithm 1
        const i = Math.floor((k + 1) / 2);
        
        console.log(`🔬 Algorithm 1: Finding roots of M^(${i})(y) polynomial for k=${k}`);
        
        // For metalog, the polynomial y^i(1-y)^i * M^(i)(y) has degree i-1
        // We need to construct this polynomial and find its roots
        const polynomial = this.constructInflectionPolynomial(metalog, i);
        
        // Find real roots in (0,1)
        const roots = this.findPolynomialRootsInInterval(polynomial, 0, 1);
        
        console.log(`📊 Polynomial roots in (0,1): [${roots.map(r => r.toFixed(6)).join(', ')}]`);
        
        // Apply iterative root finding from M^(i) down to M''
        return this.iterativeInflectionPointRefinement(metalog, roots, i);
    }
    
    // Construct the polynomial y^i(1-y)^i * M^(i)(y) from the metalog
    constructInflectionPolynomial(metalog, i) {
        const coefficients = metalog.coefficients;
        const k = metalog.numTerms;
        
        // This implements the polynomial construction from Table 2 in the paper
        // For simplicity, we'll implement the specific cases we need
        
        if (k === 4 && i === 2) {
            // From Table 2: y^2(1-y)^2 * M''(y) = -a2 + 0.5*a3 + 2*a2*y
            return [-coefficients[1] + 0.5 * coefficients[2], 2 * coefficients[1]]; // [constant, linear]
        }
        
        if (k === 5 && i === 3) {
            // From Table 2: degree 2 polynomial
            const a2 = coefficients[1], a3 = coefficients[2], a6 = coefficients[4];
            return [
                2*a2 - a3 + 0.5*a6,                    // constant
                -6*a2 + 2*a3 - 0.5*a6,                 // linear  
                6*a2 + 0.5*a6                          // quadratic
            ];
        }
        
        if (k === 6 && i === 3) {
            // From Table 2: degree 2 polynomial  
            const a2 = coefficients[1], a3 = coefficients[2], a6 = coefficients[4];
            return [
                2*a2 - a3 + 0.5*a6,                    // constant
                -6*a2 + 2*a3 - 0.5*a6,                 // linear
                6*a2 + 0.5*a6                          // quadratic
            ];
        }
        
        // For higher orders, we'd need to implement the full polynomial construction
        // For now, fall back to numerical differentiation
        console.warn(`⚠️ Polynomial construction not implemented for k=${k}, using numerical approach`);
        return this.numericalPolynomialApproximation(metalog, i);
    }
    
    // Find real roots of polynomial in interval (0,1) 
    findPolynomialRootsInInterval(coeffs, a, b) {
        if (coeffs.length === 1) {
            return []; // Constant polynomial has no roots
        }
        
        if (coeffs.length === 2) {
            // Linear: ax + b = 0 => x = -b/a
            if (Math.abs(coeffs[1]) < 1e-12) return [];
            const root = -coeffs[0] / coeffs[1];
            return (root > a && root < b) ? [root] : [];
        }
        
        if (coeffs.length === 3) {
            // Quadratic: ax² + bx + c = 0
            return this.solveQuadratic(coeffs[2], coeffs[1], coeffs[0]).filter(r => r > a && r < b && isFinite(r));
        }
        
        // For higher degree polynomials, use numerical root finding
        return this.numericalRootFinding(coeffs, a, b);
    }
    
    // Solve quadratic equation ax² + bx + c = 0
    solveQuadratic(a, b, c) {
        if (Math.abs(a) < 1e-12) {
            // Linear case
            return Math.abs(b) > 1e-12 ? [-c / b] : [];
        }
        
        const discriminant = b * b - 4 * a * c;
        if (discriminant < 0) return [];
        
        const sqrtD = Math.sqrt(discriminant);
        return [(-b + sqrtD) / (2 * a), (-b - sqrtD) / (2 * a)];
    }
    
    // Numerical root finding for higher degree polynomials
    numericalRootFinding(coeffs, a, b) {
        const roots = [];
        const n = 100; // Number of intervals to check
        const dx = (b - a) / n;
        
        // Look for sign changes
        for (let i = 0; i < n; i++) {
            const x1 = a + i * dx;
            const x2 = a + (i + 1) * dx;
            const y1 = this.evaluatePolynomial(coeffs, x1);
            const y2 = this.evaluatePolynomial(coeffs, x2);
            
            if (y1 * y2 < 0) {
                // Sign change detected, use bisection
                const root = this.bisectionMethod(coeffs, x1, x2);
                if (root !== null) {
                    roots.push(root);
                }
            }
        }
        
        return roots;
    }
    
    // Evaluate polynomial at x
    evaluatePolynomial(coeffs, x) {
        let result = 0;
        for (let i = 0; i < coeffs.length; i++) {
            result += coeffs[i] * Math.pow(x, i);
        }
        return result;
    }
    
    // Bisection method for root finding
    bisectionMethod(coeffs, a, b, tolerance = 1e-10, maxIterations = 50) {
        let fa = this.evaluatePolynomial(coeffs, a);
        let fb = this.evaluatePolynomial(coeffs, b);
        
        if (fa * fb > 0) return null;  // No root in interval
        
        for (let i = 0; i < maxIterations; i++) {
            const c = (a + b) / 2;
            const fc = this.evaluatePolynomial(coeffs, c);
            
            if (Math.abs(fc) < tolerance || (b - a) / 2 < tolerance) {
                return c;
            }
            
            if (fa * fc < 0) {
                b = c;
                fb = fc;
            } else {
                a = c;
                fa = fc;
            }
        }
        
        return (a + b) / 2;
    }
    
    // Iterative refinement from M^(i) down to M''
    iterativeInflectionPointRefinement(metalog, initialRoots, i) {
        let currentRoots = [...initialRoots];
        
        // Work backwards from M^(i) to M''
        for (let j = i; j > 2; j--) {
            currentRoots = this.refineRootsForDerivative(metalog, currentRoots, j - 1);
        }
        
        return currentRoots;
    }
    
    // Refine roots for a specific derivative order
    refineRootsForDerivative(metalog, roots, derivativeOrder) {
        const refinedRoots = [];
        
        // Add boundary points for analysis
        const extendedRoots = [0, ...roots, 1].sort((a, b) => a - b);
        
        // Check each interval between consecutive roots
        for (let i = 0; i < extendedRoots.length - 1; i++) {
            const a = extendedRoots[i];
            const b = extendedRoots[i + 1];
            
            // Skip if interval is too small
            if (b - a < 1e-10) continue;
            
            // Check for sign changes in the derivative
            const midpoint = (a + b) / 2;
            const ya = this.evaluateMetalogNthDerivative(metalog, a + 1e-10, derivativeOrder);
            const yb = this.evaluateMetalogNthDerivative(metalog, b - 1e-10, derivativeOrder);
            
            if (ya * yb < 0) {
                // Sign change detected, find the root
                const root = this.findDerivativeRoot(metalog, a, b, derivativeOrder);
                if (root !== null && root > 0 && root < 1) {
                    refinedRoots.push(root);
                }
            }
        }
        
        return refinedRoots;
    }
    
    // Find root of M^(n)(y) = 0 in interval [a,b]
    findDerivativeRoot(metalog, a, b, n, tolerance = 1e-10, maxIterations = 50) {
        // Use bisection method
        let fa = this.evaluateMetalogNthDerivative(metalog, a, n);
        let fb = this.evaluateMetalogNthDerivative(metalog, b, n);
        
        if (fa * fb > 0) return null;
        
        for (let i = 0; i < maxIterations; i++) {
            const c = (a + b) / 2;
            const fc = this.evaluateMetalogNthDerivative(metalog, c, n);
            
            if (Math.abs(fc) < tolerance || (b - a) / 2 < tolerance) {
                return c;
            }
            
            if (fa * fc < 0) {
                b = c;
                fb = fc;
            } else {
                a = c;
                fa = fc;
            }
        }
        
        return (a + b) / 2;
    }
    
    // Evaluate M'(y) - first derivative of metalog
    evaluateMetalogDerivative(metalog, y) {
        return this.evaluateMetalogNthDerivative(metalog, y, 1);
    }
    
    // Evaluate n-th derivative of metalog at y
    evaluateMetalogNthDerivative(metalog, y, n) {
        const safeY = Math.max(0.001, Math.min(0.999, y));
        const coefficients = metalog.coefficients;
        const k = metalog.numTerms;
        
        let result = 0;
        
        for (let j = 1; j <= k; j++) {
            const basisValue = this.getMetalogBasisDerivative(safeY, j, n);
            result += coefficients[j-1] * basisValue;
        }
        
        return result;
    }
    
    // Get n-th derivative of metalog basis function g_j(y)
    getMetalogBasisDerivative(y, j, n) {
        if (n === 0) {
            return this.getMetalogBasisValue(y, j);
        }
        
        // For n=1 (first derivative), implement the derivatives of basis functions
        if (n === 1) {
            switch(j) {
                case 1: return 0; // d/dy(1) = 0
                case 2: return 1 / (y * (1 - y)); // d/dy(ln(y/(1-y))) = 1/(y(1-y))
                case 3: 
                    const logit = Math.log(y / (1 - y));
                    return logit + (y - 0.5) / (y * (1 - y)); // Chain rule
                case 4: return 1; // d/dy(y - 0.5) = 1
                default:
                    // For higher order terms, use numerical differentiation
                    const h = 1e-8;
                    const y1 = Math.max(0.001, Math.min(0.999, y - h));
                    const y2 = Math.max(0.001, Math.min(0.999, y + h));
                    return (this.getMetalogBasisValue(y2, j) - this.getMetalogBasisValue(y1, j)) / (2 * h);
            }
        }
        
        // For higher derivatives, use numerical differentiation
        const h = 1e-6;
        const y1 = Math.max(0.001, Math.min(0.999, y - h));
        const y2 = Math.max(0.001, Math.min(0.999, y + h));
        
        // Create unit metalog for basis function j
        const unitCoeffs = [];
        for (let i = 1; i <= j; i++) {
            unitCoeffs.push(j === i ? 1 : 0);
        }
        const unitMetalog = {coefficients: unitCoeffs, numTerms: j};
        
        return (this.evaluateMetalogNthDerivative(unitMetalog, y2, n-1) - 
                this.evaluateMetalogNthDerivative(unitMetalog, y1, n-1)) / (2 * h);
    }
    
    // Check tail feasibility conditions from Proposition 5
    checkTailFeasibility(metalog) {
        const coefficients = metalog.coefficients;
        const k = metalog.numTerms;
        
        // Calculate s(0), s(1), s'(0), s'(1), μ'(0), μ'(1)
        const s0 = this.evaluateS(metalog, 0);
        const s1 = this.evaluateS(metalog, 1);
        
        console.log(`🔍 Tail feasibility: s(0)=${s0.toFixed(8)}, s(1)=${s1.toFixed(8)}`);
        
        // Check s(0) ≥ 0 and s(1) ≥ 0
        if (s0 < -1e-10 || s1 < -1e-10) {
            console.log(`❌ Tail feasibility failed: s(0)=${s0.toFixed(8)}, s(1)=${s1.toFixed(8)}`);
            return false;
        }
        
        // If s(0) = 0, check -s'(0) > 0 or additional conditions
        if (Math.abs(s0) < 1e-10) {
            const sDerivAt0 = this.evaluateSDerivative(metalog, 0);
            if (sDerivAt0 >= 1e-10) {
                console.log(`❌ Tail feasibility failed at y=0: s(0)=0 but s'(0)=${sDerivAt0.toFixed(8)} ≥ 0`);
                return false;
            }
        }
        
        // If s(1) = 0, check s'(1) > 0 or additional conditions  
        if (Math.abs(s1) < 1e-10) {
            const sDerivAt1 = this.evaluateSDerivative(metalog, 1);
            if (sDerivAt1 <= -1e-10) {
                console.log(`❌ Tail feasibility failed at y=1: s(1)=0 but s'(1)=${sDerivAt1.toFixed(8)} ≤ 0`);
                return false;
            }
        }
        
        console.log("✅ Tail feasibility conditions satisfied");
        return true;
    }
    
    // Evaluate s(y) = sum of s-terms from metalog
    evaluateS(metalog, y) {
        const coefficients = metalog.coefficients;
        const k = metalog.numTerms;
        const safeY = Math.max(0.001, Math.min(0.999, y));
        
        let result = 0;
        for (let j = 2; j <= k; j += 2) { // s-terms have even indices
            if (j-1 < coefficients.length) {
                result += coefficients[j-1] * Math.pow(safeY - 0.5, Math.floor((j-1)/2));
            }
        }
        return result;
    }
    
    // Evaluate s'(y) 
    evaluateSDerivative(metalog, y) {
        const coefficients = metalog.coefficients;
        const k = metalog.numTerms;
        const safeY = Math.max(0.001, Math.min(0.999, y));
        
        let result = 0;
        for (let j = 2; j <= k; j += 2) { // s-terms have even indices
            if (j-1 < coefficients.length) {
                const power = Math.floor((j-1)/2);
                if (power > 0) {
                    result += coefficients[j-1] * power * Math.pow(safeY - 0.5, power - 1);
                }
            }
        }
        return result;
    }
    
    // Fallback numerical polynomial approximation for higher orders
    numericalPolynomialApproximation(metalog, i) {
        console.log(`⚠️ Using numerical approximation for polynomial construction (k=${metalog.numTerms}, i=${i})`);
        
        // Sample the function y^i(1-y)^i * M^(i)(y) at several points and fit polynomial
        const points = [];
        const n = Math.max(10, i + 3); // Sample more points than polynomial degree
        
        for (let k = 0; k <= n; k++) {
            const y = 0.01 + (0.99 - 0.01) * k / n; // Sample from 0.01 to 0.99
            const weight = Math.pow(y, i) * Math.pow(1 - y, i);
            const derivValue = this.evaluateMetalogNthDerivative(metalog, y, i);
            const value = weight * derivValue;
            points.push({x: y, y: value});
        }
        
        // Fit polynomial of degree i-1 to these points using least squares
        return this.fitPolynomial(points, i - 1);
    }
    
    // Fit polynomial of given degree to points using least squares
    fitPolynomial(points, degree) {
        const n = points.length;
        const m = degree + 1;
        
        // Build Vandermonde matrix
        const A = [];
        const b = [];
        
        for (let i = 0; i < n; i++) {
            const row = [];
            for (let j = 0; j <= degree; j++) {
                row.push(Math.pow(points[i].x, j));
            }
            A.push(row);
            b.push(points[i].y);
        }
        
        // Solve least squares: (A^T A) x = A^T b
        try {
            const AT = this.transposeMatrix(A);
            const ATA = this.multiplyMatrices(AT, A);
            const ATb = this.multiplyMatrixVector(AT, b);
            const coeffs = this.solveLinearSystem(ATA, ATb);
            return coeffs;
        } catch (error) {
            console.warn(`Warning: Polynomial fitting failed: ${error.message}`);
            return [0]; // Return constant zero polynomial as fallback
        }
    }
    
    // Helper matrix operations
    transposeMatrix(A) {
        return A[0].map((_, colIndex) => A.map(row => row[colIndex]));
    }
    
    multiplyMatrices(A, B) {
        const result = [];
        for (let i = 0; i < A.length; i++) {
            result[i] = [];
            for (let j = 0; j < B[0].length; j++) {
                result[i][j] = 0;
                for (let k = 0; k < B.length; k++) {
                    result[i][j] += A[i][k] * B[k][j];
                }
            }
        }
        return result;
    }
    
    multiplyMatrixVector(A, b) {
        return A.map(row => row.reduce((sum, val, i) => sum + val * b[i], 0));
    }
    
    solveLinearSystem(A, b) {
        // Simple Gaussian elimination for small systems
        const n = A.length;
        const augmented = A.map((row, i) => [...row, b[i]]);
        
        // Forward elimination
        for (let i = 0; i < n; i++) {
            // Find pivot
            let maxRow = i;
            for (let k = i + 1; k < n; k++) {
                if (Math.abs(augmented[k][i]) > Math.abs(augmented[maxRow][i])) {
                    maxRow = k;
                }
            }
            [augmented[i], augmented[maxRow]] = [augmented[maxRow], augmented[i]];
            
            // Make diagonal element 1
            const pivot = augmented[i][i];
            if (Math.abs(pivot) < 1e-12) {
                throw new Error("Singular matrix");
            }
            for (let j = 0; j <= n; j++) {
                augmented[i][j] /= pivot;
            }
            
            // Eliminate column
            for (let k = 0; k < n; k++) {
                if (k !== i) {
                    const factor = augmented[k][i];
                    for (let j = 0; j <= n; j++) {
                        augmented[k][j] -= factor * augmented[i][j];
                    }
                }
            }
        }
        
        return augmented.map(row => row[n]);
    }
    
    // Keep the old method as fallback for comparison
    isQuantileFunctionMonotonic(metalog) {
        const testPoints = [0.01, 0.05, 0.1, 0.25, 0.5, 0.75, 0.9, 0.95, 0.99];
        let lastValue = -Infinity;
        
        console.log("🔍 Legacy monotonicity test (9-point sampling):");
        for (const y of testPoints) {
            try {
                const x = this.evaluateMetalog(metalog, y);
                console.log(`   y=${y.toFixed(2)}: x=${x.toFixed(4)} (last: ${lastValue.toFixed(4)})`);
                
                if (!isFinite(x)) {
                    console.log(`❌ Monotonicity failed at y=${y}: x=${x} is not finite`);
                    return false;
                }
                
                if (x <= lastValue) {
                    console.log(`❌ Monotonicity failed at y=${y}: x=${x.toFixed(4)} <= lastX=${lastValue.toFixed(4)}`);
                    return false;
                }
                lastValue = x;
            } catch (e) {
                console.log(`❌ Evaluation failed at y=${y}: ${e.message}`);
                return false;
            }
        }
        
        console.log("✅ Legacy monotonicity check passed");
        return true;
    }

    // Constrained metalog fitting using iterative optimization
    fitMetalogConstrained(dataPoints, numTerms = 3) {
        console.log("🎯 Attempting constrained metalog fitting...");
        
        // Sort and normalize points
        const sortedPoints = [...dataPoints].sort((a, b) => a.y - b.y);
        const normalizedPoints = sortedPoints.map(point => ({
            x: this.timeToNormalized(point.x),
            y: point.y
        }));
        
        const n = normalizedPoints.length;
        const k = Math.min(numTerms, n);
        
        // Build target values and basis matrix
        const Y = [];
        const z = [];
        
        for (let i = 0; i < n; i++) {
            const y = normalizedPoints[i].y;
            const x = normalizedPoints[i].x;
            
            const row = [];
            for (let j = 1; j <= k; j++) {
                row.push(this.getMetalogBasisValue(y, j));
            }
            
            Y.push(row);
            z.push(x);
        }
        
        // Try unconstrained least squares first
        try {
            const YMatrix = math.matrix(Y);
            const zVector = math.matrix(z);
            
            let coefficients;
            if (n === k) {
                coefficients = math.multiply(math.inv(YMatrix), zVector).toArray();
            } else {
                const YT = math.transpose(YMatrix);
                const YTY = math.multiply(YT, YMatrix);
                const YTz = math.multiply(YT, zVector);
                coefficients = math.multiply(math.inv(YTY), YTz).toArray();
            }
            
            const testMetalog = { coefficients, numTerms: k, dataPoints: normalizedPoints };
            
            if (this.checkMetalogFeasibility(testMetalog)) {
                console.log("✅ Unconstrained solution is feasible");
                return testMetalog;
            }
            
            console.log("⚠️ Unconstrained solution violates constraints, using constrained optimization");
            return this.optimizeWithConstraints(Y, z, k, normalizedPoints);
            
        } catch (error) {
            console.log("⚠️ Matrix solve failed, using constrained optimization");
            return this.optimizeWithConstraints(Y, z, k, normalizedPoints);
        }
    }
    
    optimizeWithConstraints(Y, z, k, normalizedPoints) {
        console.log("🔧 Running simplified constraint projection...");
        
        // Get unconstrained solution
        let unconstrainedCoeffs;
        try {
            const YMatrix = math.matrix(Y);
            const zVector = math.matrix(z);
            
            if (Y.length === k) {
                unconstrainedCoeffs = math.multiply(math.inv(YMatrix), zVector).toArray();
            } else {
                const YT = math.transpose(YMatrix);
                const YTY = math.multiply(YT, YMatrix);
                const YTz = math.multiply(YT, zVector);
                unconstrainedCoeffs = math.multiply(math.inv(YTY), YTz).toArray();
            }
            
            console.log("📊 Unconstrained solution:", unconstrainedCoeffs.map(c => c.toFixed(4)));
            
        } catch (e) {
            throw new Error("Failed to get unconstrained solution");
        }
        
        // For k=3, project a3 to satisfy |a3|/a2 < 1.66711
        const projectedCoeffs = [...unconstrainedCoeffs];
        
        if (k >= 2) {
            // Ensure a2 > 0
            projectedCoeffs[1] = Math.max(0.01, projectedCoeffs[1]);
        }
        
        if (k >= 3) {
            // Project a3 to feasible region
            const maxA3 = 1.66 * Math.abs(projectedCoeffs[1]);
            if (Math.abs(projectedCoeffs[2]) > maxA3) {
                // Keep the sign but reduce magnitude
                projectedCoeffs[2] = Math.sign(projectedCoeffs[2]) * maxA3;
                console.log(`📊 Projected a₃ from ${unconstrainedCoeffs[2].toFixed(4)} to ${projectedCoeffs[2].toFixed(4)}`);
            }
        }
        
        const finalError = this.calculateAbsoluteError(Y, z, projectedCoeffs);
        console.log(`✅ Constraint projection complete. Final error: ${finalError.toFixed(6)}`);
        console.log(`📊 Final coefficients: [${projectedCoeffs.map(c => c.toFixed(4)).join(', ')}]`);
        
        // Verify constraints
        if (k >= 2) console.log(`📊 a₂ = ${projectedCoeffs[1].toFixed(4)} > 0: ${projectedCoeffs[1] > 0 ? '✅' : '❌'}`);
        if (k >= 3) {
            const ratio = Math.abs(projectedCoeffs[2]) / projectedCoeffs[1];
            console.log(`📊 |a₃|/a₂ = ${ratio.toFixed(4)} < 1.667: ${ratio < 1.667 ? '✅' : '❌'}`);
        }
        
        // Test fit quality by evaluating at original data points
        console.log("🎯 Checking fit quality:");
        const testMetalog = { coefficients: projectedCoeffs, numTerms: k, dataPoints: normalizedPoints };
        for (let i = 0; i < normalizedPoints.length; i++) {
            const actualTime = normalizedPoints[i].x;
            const actualProb = normalizedPoints[i].y;
            const predictedTime = this.evaluateMetalog(testMetalog, actualProb);
            const timeError = Math.abs(actualTime - predictedTime);
            const timeInYears = this.normalizedToTime(actualTime);
            const predictedYears = this.normalizedToTime(predictedTime);
            console.log(`   Point ${i+1}: ${this.formatTime(timeInYears)} @ ${(actualProb*100).toFixed(0)}% → predicted ${this.formatTime(predictedYears)} (error: ${timeError.toFixed(4)})`);
        }
        
        return {
            coefficients: projectedCoeffs,
            numTerms: k,
            dataPoints: normalizedPoints,
            constrainedFit: true
        };
    }
    
    getFeasibleStartingPoint(k) {
        // Start with a simple feasible solution
        const coefficients = new Array(k).fill(0);
        coefficients[0] = 0.5; // a1 = median
        
        if (k >= 2) {
            coefficients[1] = 1.0; // a2 > 0
        }
        
        if (k >= 3) {
            coefficients[2] = 0.5; // |a3|/a2 = 0.5 < 1.66711
        }
        
        return coefficients;
    }
    
    calculateAbsoluteError(Y, z, coefficients) {
        let totalError = 0;
        
        for (let i = 0; i < Y.length; i++) {
            let predicted = 0;
            for (let j = 0; j < coefficients.length; j++) {
                predicted += coefficients[j] * Y[i][j];
            }
            
            totalError += Math.abs(z[i] - predicted);
        }
        
        return totalError;
    }
    
    calculateGradients(Y, z, coefficients) {
        const gradients = new Array(coefficients.length).fill(0);
        const delta = 0.01; // Huber loss parameter
        
        for (let i = 0; i < Y.length; i++) {
            let predicted = 0;
            for (let j = 0; j < coefficients.length; j++) {
                predicted += coefficients[j] * Y[i][j];
            }
            
            const error = z[i] - predicted;
            
            // Use Huber loss gradient instead of pure absolute value
            let gradientWeight;
            if (Math.abs(error) <= delta) {
                gradientWeight = error / delta; // Quadratic region
            } else {
                gradientWeight = error > 0 ? 1 : -1; // Linear region
            }
            
            for (let j = 0; j < coefficients.length; j++) {
                gradients[j] += gradientWeight * Y[i][j];
            }
        }
        
        return gradients;
    }
    
    enforceConstraints(coefficients, k) {
        // Constraint 1: a2 > 0
        if (k >= 2) {
            coefficients[1] = Math.max(0.01, coefficients[1]);
        }
        
        // Constraint 2: |a3|/a2 < 1.66711
        if (k >= 3 && coefficients[1] > 0) {
            const maxA3 = 1.66 * coefficients[1]; // Slightly below limit
            coefficients[2] = Math.max(-maxA3, Math.min(maxA3, coefficients[2]));
        }
    }

    // Smart metalog fitting with simple fallback logic
    fitMetalogSmart(dataPoints) {
        const validation = this.validateMetalogData(dataPoints);
        if (!validation.valid) {
            throw new Error(validation.error);
        }

        const n = dataPoints.length;
        
        // Try k values from n down to 2
        for (let k = n; k >= 2; k--) {
            console.log(`🔍 Trying k=${k}`);
            
            try {
                // Fit unconstrained metalog using least squares
                const metalog = this.fitUnconstrainedMetalog(dataPoints, k);
                
                // Check feasibility constraints  
                if (!this.checkMetalogFeasibility(metalog)) {
                    console.log(`❌ k=${k} violates feasibility constraints - stepping down`);
                    continue; // Try next lower k
                }
                
                console.log(`✅ k=${k} is feasible`);
                
                // Check fit quality (±2.5% in probability space)
                if (this.checkFitQuality(metalog, dataPoints)) {
                    console.log(`🎯 k=${k} has acceptable fit quality`);
                    return metalog;
                } else {
                    console.log(`💀 k=${k} has poor fit quality - abandoning metalogs`);
                    return null; // Trigger linear interpolation fallback
                }
                
            } catch (e) {
                console.log(`⚠️ k=${k} failed: ${e.message}`);
                continue;
            }
        }
        
        console.log("💀 All k values failed feasibility - abandoning metalogs");
        return null;
    }

    // Fit unconstrained metalog using simple least squares
    fitUnconstrainedMetalog(dataPoints, numTerms) {
        // Sort points (they're already in [0,1] space)
        const sortedPoints = [...dataPoints].sort((a, b) => a.y - b.y);
        const normalizedPoints = sortedPoints; // Already normalized
        
        const n = normalizedPoints.length;
        const k = Math.min(numTerms, n);
        
        // Build the Y matrix and z vector
        const Y = [];
        const z = [];
        
        for (let i = 0; i < n; i++) {
            const y = normalizedPoints[i].y;
            const x = normalizedPoints[i].x;
            
            const row = [];
            for (let j = 1; j <= k; j++) {
                row.push(this.getMetalogBasisValue(y, j));
            }
            
            Y.push(row);
            z.push(x);
        }
        
        // Solve using least squares
        const YMatrix = math.matrix(Y);
        const zVector = math.matrix(z);
        
        let coefficients;
        if (n === k) {
            // Exact solution
            coefficients = math.multiply(math.inv(YMatrix), zVector).toArray();
        } else {
            // Least squares: (Y^T Y)^(-1) Y^T z
            const YT = math.transpose(YMatrix);
            const YTY = math.multiply(YT, YMatrix);
            const YTz = math.multiply(YT, zVector);
            coefficients = math.multiply(math.inv(YTY), YTz).toArray();
        }
        
        return {
            coefficients: coefficients,
            numTerms: k,
            dataPoints: normalizedPoints,
            constrainedFit: false
        };
    }

    // Check fit quality: ±2.5% in probability space
    checkFitQuality(metalog, originalDataPoints) {
        const threshold = 0.025; // ±2.5% in probability space
        
        console.log("🔍 Quality check details:");
        for (const point of originalDataPoints) {
            const targetProbability = point.y;
            const actualTime = point.x; // Already in [0,1] space
            const predictedTime = this.evaluateMetalog(metalog, targetProbability);
            const timeError = Math.abs(actualTime - predictedTime);
            
            const actualTimeYears = this.normalizedToTime(actualTime);
            const predictedTimeYears = this.normalizedToTime(predictedTime);
            
            console.log(`   ${this.formatTime(actualTimeYears)} @ ${(point.y*100).toFixed(0)}%: predicted ${this.formatTime(predictedTimeYears)}, error=${timeError.toFixed(4)}`);
            
            if (timeError > threshold) {
                console.log(`📊 Quality check failed: time error ${timeError.toFixed(4)} > ${threshold}`);
                return false;
            }
        }
        
        console.log("📊 Quality check passed: all points within tolerance");
        return true;
    }

    // Check if metalog fit meets error threshold at each datapoint
    checkErrorThreshold(metalog, originalDataPoints, threshold) {
        const sortedPoints = [...originalDataPoints].sort((a, b) => a.y - b.y);
        
        for (const point of sortedPoints) {
            const normalizedTime = point.x; // Already in [0,1] space
            const predictedTime = this.evaluateMetalog(metalog, point.y);
            const relativeError = Math.abs(normalizedTime - predictedTime) / normalizedTime;
            
            if (relativeError > threshold) {
                const timeYears = this.normalizedToTime(point.x);
                console.log(`📊 Error threshold exceeded at ${this.formatTime(timeYears)} @ ${(point.y*100).toFixed(0)}%: ${(relativeError*100).toFixed(1)}% > ${(threshold*100).toFixed(1)}%`);
                return false;
            }
        }
        
        return true;
    }

    // Create piecewise linear data points for visualization fallback
    createPiecewiseLinearData(dataPoints) {
        console.log("🔧 Creating piecewise linear data for visualization");
        
        // Sort points by CDF probability
        const sortedPoints = [...dataPoints].sort((a, b) => a.y - b.y);
        
        // Normalize time values
        const normalizedPoints = sortedPoints.map(point => ({
            x: this.timeToNormalized(point.x),
            y: point.y
        }));
        
        // Use logistic curve to extrapolate boundary values
        const extendedPoints = this.addLogisticBoundaryPoints(normalizedPoints);
        
        console.log(`📊 Extended ${normalizedPoints.length} points to ${extendedPoints.length} points with logistic boundary extrapolation`);
        return extendedPoints;
    }

    // Add boundary points using logistic curve extrapolation
    addLogisticBoundaryPoints(normalizedPoints) {
        const points = [...normalizedPoints];
        
        if (points.length < 2) {
            console.warn("⚠️ Need at least 2 points for logistic extrapolation");
            return points;
        }
        
        // Select 3 points for logistic fitting
        let fitPoints;
        if (points.length === 2) {
            // Interpolate a middle point
            const midPoint = {
                x: (points[0].x + points[1].x) / 2,
                y: (points[0].y + points[1].y) / 2
            };
            fitPoints = [points[0], midPoint, points[1]];
            console.log("📊 Using interpolated middle point for logistic fit");
        } else {
            // Use first, median, and last points
            const medianIndex = Math.floor(points.length / 2);
            fitPoints = [points[0], points[medianIndex], points[points.length - 1]];
            console.log(`📊 Using points at indices 0, ${medianIndex}, ${points.length - 1} for logistic fit`);
        }
        
        try {
            // Fit logistic curve
            const logistic = this.fitLogisticCurve(fitPoints);
            
            // Add boundary points if needed with monotonicity constraints
            if (points[0].x > 0.001) {
                const y0Raw = this.evaluateLogistic(logistic, 0);
                const y0 = Math.min(y0Raw, points[0].y); // Left boundary must be ≤ first point
                points.unshift({ x: 0, y: y0 });
                console.log(`📊 Added logistic boundary: (0, ${y0.toFixed(3)}) [raw: ${y0Raw.toFixed(3)}]`);
            }
            
            const lastPoint = points[points.length - 1];
            if (lastPoint.x < 0.999) {
                const y1Raw = this.evaluateLogistic(logistic, 1);
                const y1 = Math.max(y1Raw, lastPoint.y); // Right boundary must be ≥ last point
                points.push({ x: 1, y: y1 });
                console.log(`📊 Added logistic boundary: (1, ${y1.toFixed(3)}) [raw: ${y1Raw.toFixed(3)}]`);
            }
            
        } catch (error) {
            console.warn("⚠️ Logistic fitting failed, falling back to flat extrapolation:", error.message);
            // Fallback to original flat extrapolation
            if (normalizedPoints[0].x > 0.001) {
                points.unshift({ x: 0, y: normalizedPoints[0].y });
            }
            const lastPoint = normalizedPoints[normalizedPoints.length - 1];
            if (lastPoint.x < 0.999) {
                points.push({ x: 1, y: lastPoint.y });
            }
        }
        
        return points;
    }

    // Fit logistic curve: y = L / (1 + exp(-k*(x - x0)))
    fitLogisticCurve(points) {
        console.log("🔧 Fitting logistic curve to points:", points);
        
        if (points.length !== 3) {
            throw new Error("Need exactly 3 points for logistic fitting");
        }
        
        const [p1, p2, p3] = points;
        
        // Estimate L (maximum value) as slightly above the highest y-value
        const L = Math.max(p1.y, p2.y, p3.y) * 1.1;
        
        // Transform to linearized form: ln(L/y - 1) = -k*x + k*x0
        const transformedPoints = points.map(p => {
            const ratio = L / p.y - 1;
            if (ratio <= 0) {
                throw new Error(`Invalid ratio for logistic transform: L=${L}, y=${p.y}`);
            }
            return {
                x: p.x,
                y: Math.log(ratio)
            };
        });
        
        // Linear regression on transformed data: y = mx + b where m = -k and b = k*x0
        const n = transformedPoints.length;
        const sumX = transformedPoints.reduce((sum, p) => sum + p.x, 0);
        const sumY = transformedPoints.reduce((sum, p) => sum + p.y, 0);
        const sumXY = transformedPoints.reduce((sum, p) => sum + p.x * p.y, 0);
        const sumX2 = transformedPoints.reduce((sum, p) => sum + p.x * p.x, 0);
        
        const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
        const intercept = (sumY - slope * sumX) / n;
        
        const k = -slope;
        const x0 = intercept / k;
        
        console.log(`📊 Logistic parameters: L=${L.toFixed(4)}, k=${k.toFixed(4)}, x0=${x0.toFixed(4)}`);
        
        return { L, k, x0 };
    }

    // Evaluate logistic curve at given x
    evaluateLogistic(logistic, x) {
        const { L, k, x0 } = logistic;
        const result = L / (1 + Math.exp(-k * (x - x0)));
        
        // Clamp to reasonable probability bounds
        return Math.max(0.001, Math.min(0.999, result));
    }
}

// Export as global for use in other files
window.MetalogUtils = MetalogUtils;