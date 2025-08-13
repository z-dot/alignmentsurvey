// Initialization Test Battery
// Runs comprehensive tests on page load if enabled

class InitTests {
    constructor() {
        this.testResults = [];
        this.enableTests = this.shouldRunTests();
    }

    shouldRunTests() {
        // Enable tests if:
        // 1. URL parameter ?test=true
        // 2. localStorage flag 'cdf-run-tests' is set
        // 3. Development mode (localhost)
        const urlParams = new URLSearchParams(window.location.search);
        const hasTestParam = urlParams.get('test') === 'true';
        const hasStorageFlag = localStorage.getItem('cdf-run-tests') === 'true';
        const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
        
        return hasTestParam || hasStorageFlag || isLocalhost;
    }

    runAllTests() {
        if (!this.enableTests) {
            console.log('📊 Init tests disabled');
            return;
        }

        console.log('🧪 Running initialization test battery...');
        
        this.testConversionUtils();
        this.testMetalogUtils();
        this.testParsingEdgeCases();
        this.testRoundTripConversions();
        this.testFormatting();
        
        this.logResults();
    }

    test(name, condition, details = '') {
        const passed = Boolean(condition);
        this.testResults.push({ name, passed, details });
        
        if (passed) {
            console.log(`✅ ${name}${details ? ' - ' + details : ''}`);
        } else {
            console.error(`❌ ${name}${details ? ' - ' + details : ''}`);
        }
        
        return passed;
    }

    testConversionUtils() {
        console.group('🔄 ConversionUtils Tests');
        
        try {
            const convUtils = new ConversionUtils();
            
            // Basic parsing
            this.test('parseTimeInput - 1 year', convUtils.parseTimeInput('1 year') === 1);
            this.test('parseTimeInput - 10 years', convUtils.parseTimeInput('10 years') === 10);
            this.test('parseTimeInput - 1 day', Math.abs(convUtils.parseTimeInput('1 day') - 1/365.25) < 0.001);
            this.test('parseTimeInput - 6 months', Math.abs(convUtils.parseTimeInput('6 months') - 0.5) < 0.001);
            this.test('parseTimeInput - 1 century', convUtils.parseTimeInput('1 century') === 100);
            
            // Probability parsing
            this.test('parseProbabilityInput - 50%', convUtils.parseProbabilityInput('50%') === 0.5);
            this.test('parseProbabilityInput - 0.25', convUtils.parseProbabilityInput('0.25') === 0.25);
            this.test('parseProbabilityInput - 100%', convUtils.parseProbabilityInput('100%') === 1);
            
            // Invalid inputs
            this.test('parseTimeInput - invalid', convUtils.parseTimeInput('invalid') === null);
            this.test('parseTimeInput - negative', convUtils.parseTimeInput('-5 years') === null);
            this.test('parseProbabilityInput - invalid', convUtils.parseProbabilityInput('invalid') === null);
            
        } catch (e) {
            this.test('ConversionUtils instantiation', false, e.message);
        }
        
        console.groupEnd();
    }

    testMetalogUtils() {
        console.group('📊 MetalogUtils Tests');
        
        try {
            const metalogUtils = new MetalogUtils();
            
            // Inheritance check
            this.test('MetalogUtils inherits parseTimeInput', typeof metalogUtils.parseTimeInput === 'function');
            this.test('MetalogUtils inherits formatTime', typeof metalogUtils.formatTime === 'function');
            
            // Inherited functionality
            this.test('Inherited parseTimeInput works', metalogUtils.parseTimeInput('5 years') === 5);
            
            // Metalog-specific functionality
            this.test('timeToNormalized exists', typeof metalogUtils.timeToNormalized === 'function');
            this.test('normalizedToTime exists', typeof metalogUtils.normalizedToTime === 'function');
            
        } catch (e) {
            this.test('MetalogUtils tests', false, e.message);
        }
        
        console.groupEnd();
    }

    testParsingEdgeCases() {
        console.group('🔍 Parsing Edge Cases');
        
        try {
            const convUtils = new ConversionUtils();
            
            // Plural/singular variations
            this.test('1 day vs days', convUtils.parseTimeInput('1 day') === convUtils.parseTimeInput('1 days'));
            this.test('1 month vs months', convUtils.parseTimeInput('1 month') === convUtils.parseTimeInput('1 months'));
            this.test('1 year vs years', convUtils.parseTimeInput('1 year') === convUtils.parseTimeInput('1 years'));
            
            // Different formats
            this.test('Whitespace handling', convUtils.parseTimeInput('  10 years  ') === 10);
            this.test('Case insensitive', convUtils.parseTimeInput('10 YEARS') === 10);
            this.test('Mixed case', convUtils.parseTimeInput('10 Years') === 10);
            
            // Number without unit (defaults to years)
            this.test('Number only defaults to years', convUtils.parseTimeInput('5') === 5);
            
            // Percentage formats
            this.test('Percentage with spaces', convUtils.parseProbabilityInput(' 75% ') === 0.75);
            this.test('Decimal percentage', convUtils.parseProbabilityInput('12.5%') === 0.125);
            
        } catch (e) {
            this.test('Edge case parsing', false, e.message);
        }
        
        console.groupEnd();
    }

    testRoundTripConversions() {
        console.group('🔄 Round Trip Conversions');
        
        try {
            const metalogUtils = new MetalogUtils();
            
            const testValues = [1/365.25, 1/12, 0.25, 1, 3, 10, 30, 100]; // Various time values
            
            testValues.forEach(years => {
                const normalized = metalogUtils.timeToNormalized(years);
                const backToYears = metalogUtils.normalizedToTime(normalized);
                const roundTripWorks = Math.abs(backToYears - years) < 0.001;
                
                this.test(`Round trip ${years} years`, roundTripWorks, 
                         `${years} → ${normalized.toFixed(4)} → ${backToYears.toFixed(4)}`);
            });
            
        } catch (e) {
            this.test('Round trip conversions', false, e.message);
        }
        
        console.groupEnd();
    }

    testFormatting() {
        console.group('✨ Formatting Tests');
        
        try {
            const convUtils = new ConversionUtils();
            
            // Test specific formatting cases
            this.test('Format 1 day', convUtils.formatTime(1/365.25).includes('day'));
            this.test('Format 1 month', convUtils.formatTime(1/12).includes('month'));
            this.test('Format 1 year exact', convUtils.formatTime(1) === '1 year');
            this.test('Format 0.99 years', convUtils.formatTime(0.99) === '1.0 years', 'Intentional rounding for UX');
            this.test('Format 10 years', convUtils.formatTime(10) === '10 years');
            this.test('Format 1 century', convUtils.formatTime(100) === '1 century');
            
            // Probability formatting
            this.test('Format 50% probability', convUtils.formatProbability(0.5) === '50%');
            this.test('Format 25% probability', convUtils.formatProbability(0.25) === '25%');
            this.test('Format 100% probability', convUtils.formatProbability(1) === '100%');
            
        } catch (e) {
            this.test('Formatting tests', false, e.message);
        }
        
        console.groupEnd();
    }

    logResults() {
        const passed = this.testResults.filter(t => t.passed).length;
        const total = this.testResults.length;
        const failed = total - passed;
        
        console.log(`🧪 Test Results: ${passed}/${total} passed${failed > 0 ? `, ${failed} failed` : ''}`);
        
        if (failed > 0) {
            console.group('❌ Failed Tests:');
            this.testResults.filter(t => !t.passed).forEach(test => {
                console.error(`- ${test.name}${test.details ? ' - ' + test.details : ''}`);
            });
            console.groupEnd();
        } else {
            console.log('✅ All tests passed!');
        }

        // Store results for external access
        window.testResults = this.testResults;
        
        return { passed, total, failed };
    }
}

// Auto-run tests when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    const initTests = new InitTests();
    initTests.runAllTests();
    
    // Make tests available globally for manual re-running
    window.initTests = initTests;
});

// Export for manual testing
window.InitTests = InitTests;