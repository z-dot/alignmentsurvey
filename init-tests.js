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
        this.testTimelineYearInput();
        
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
            
            // Duration parsing (renamed function)
            this.test('parseDuration - 1 year', convUtils.parseDuration('1 year') === 1);
            this.test('parseDuration - 10 years', convUtils.parseDuration('10 years') === 10);
            this.test('parseDuration - 1 day', Math.abs(convUtils.parseDuration('1 day') - 1/365.25) < 0.001);
            this.test('parseDuration - 6 months', Math.abs(convUtils.parseDuration('6 months') - 0.5) < 0.001);
            this.test('parseDuration - 1 century', convUtils.parseDuration('1 century') === 100);
            
            // Legacy function still works
            this.test('parseTimeInput - legacy compatibility', convUtils.parseTimeInput('5 years') === 5);
            
            // Probability parsing
            this.test('parseProbabilityInput - 50%', convUtils.parseProbabilityInput('50%') === 0.5);
            this.test('parseProbabilityInput - 0.25', convUtils.parseProbabilityInput('0.25') === 0.25);
            this.test('parseProbabilityInput - 100%', convUtils.parseProbabilityInput('100%') === 1);
            
            // Invalid inputs for duration parsing
            this.test('parseDuration - invalid', convUtils.parseDuration('invalid') === null);
            this.test('parseDuration - negative', convUtils.parseDuration('-5 years') === null);
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
            
            // Inheritance check - both new and legacy functions
            this.test('MetalogUtils inherits parseDuration', typeof metalogUtils.parseDuration === 'function');
            this.test('MetalogUtils inherits parseAbsoluteYear', typeof metalogUtils.parseAbsoluteYear === 'function');
            this.test('MetalogUtils inherits parseTimeInput (legacy)', typeof metalogUtils.parseTimeInput === 'function');
            this.test('MetalogUtils inherits formatTime', typeof metalogUtils.formatTime === 'function');
            
            // Inherited functionality
            this.test('Inherited parseDuration works', metalogUtils.parseDuration('5 years') === 5);
            this.test('Inherited parseAbsoluteYear works', metalogUtils.parseAbsoluteYear('2030') === 2030);
            this.test('Inherited parseTimeInput (legacy) works', metalogUtils.parseTimeInput('3 years') === 3);
            
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
            
            // Duration parsing edge cases
            this.test('1 day vs days', convUtils.parseDuration('1 day') === convUtils.parseDuration('1 days'));
            this.test('1 month vs months', convUtils.parseDuration('1 month') === convUtils.parseDuration('1 months'));
            this.test('1 year vs years', convUtils.parseDuration('1 year') === convUtils.parseDuration('1 years'));
            
            // Different formats for durations
            this.test('Whitespace handling', convUtils.parseDuration('  10 years  ') === 10);
            this.test('Case insensitive', convUtils.parseDuration('10 YEARS') === 10);
            this.test('Mixed case', convUtils.parseDuration('10 Years') === 10);
            
            // Number without unit (defaults to years)
            this.test('Number only defaults to years', convUtils.parseDuration('5') === 5);
            
            // Absolute year parsing edge cases
            this.test('Absolute year with whitespace', convUtils.parseAbsoluteYear('  2030  ') === 2030);
            this.test('Fractional year parsing', convUtils.parseAbsoluteYear('2029.8') === 2029.8);
            
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

    testTimelineYearInput() {
        console.group('🧪 Testing Timeline Year Input');
        
        try {
            // Use ConversionUtils which is available from conversion-utilities.js
            const conversionUtils = new ConversionUtils();
            
            // Test absolute year parsing (new function)
            this.test('Parse "2030" as absolute year', 
                conversionUtils.parseAbsoluteYear("2030") === 2030);
            
            this.test('Parse "2045" as absolute year', 
                conversionUtils.parseAbsoluteYear("2045") === 2045);
            
            // Test half-years - the key question!
            this.test('Parse "2027.5" as half year', 
                conversionUtils.parseAbsoluteYear("2027.5") === 2027.5);
            
            this.test('Parse "2033.5" as half year', 
                conversionUtils.parseAbsoluteYear("2033.5") === 2033.5);
            
            // Test quarter years
            this.test('Parse "2026.25" as quarter year', 
                conversionUtils.parseAbsoluteYear("2026.25") === 2026.25);
            
            this.test('Parse "2028.75" as quarter year', 
                conversionUtils.parseAbsoluteYear("2028.75") === 2028.75);
            
            // Test duration parsing (renamed function) 
            this.test('Parse "5 years" as duration', 
                conversionUtils.parseDuration("5 years") === 5);
            
            this.test('Parse "2 years" as duration', 
                conversionUtils.parseDuration("2 years") === 2);
            
            // Test backward compatibility (legacy function)
            this.test('Legacy parseTimeInput still works for durations', 
                conversionUtils.parseTimeInput("3 years") === 3);
            
            // Test invalid inputs for absolute years
            this.test('Parse invalid year returns null', 
                conversionUtils.parseAbsoluteYear("not-a-year") === null);
            
            this.test('Parse empty string returns null', 
                conversionUtils.parseAbsoluteYear("") === null);
            
            this.test('Parse out-of-range year returns null', 
                conversionUtils.parseAbsoluteYear("1990") === null);
            
            // Test that absolute year parser rejects duration strings
            this.test('parseAbsoluteYear rejects "5 years"', 
                conversionUtils.parseAbsoluteYear("5 years") === null);
            
        } catch (e) {
            this.test('Timeline year input parsing', false, e.message);
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