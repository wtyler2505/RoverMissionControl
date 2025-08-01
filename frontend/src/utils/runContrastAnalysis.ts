/**
 * Run contrast analysis and generate report
 * This file can be executed to get a full contrast audit
 */

import { analyzeColorContrast, generateContrastReport } from './colorContrastAnalyzer';

// Run the analysis
const results = analyzeColorContrast();
const report = generateContrastReport();

console.log('=== ROVER MISSION CONTROL - COLOR CONTRAST ANALYSIS ===\n');

// Summary
console.log('SUMMARY:');
console.log(`Total combinations analyzed: ${report.summary.total}`);
console.log(`Passing WCAG 2.1 AA: ${report.summary.passing}`);
console.log(`Failing WCAG 2.1 AA: ${report.summary.failing}`);
console.log(`AA Compliant: ${report.summary.aaCompliant}`);
console.log(`AAA Compliant: ${report.summary.aaaCompliant}\n`);

// Failing combinations
console.log('FAILING COMBINATIONS:');
console.log('=====================');
report.failingCombinations.forEach((result, index) => {
  console.log(`${index + 1}. ${result.combination.context}`);
  console.log(`   Foreground: ${result.combination.foreground}`);
  console.log(`   Background: ${result.combination.background}`);
  console.log(`   Contrast Ratio: ${result.result.ratio.toFixed(2)}:1`);
  console.log(`   Level: ${result.result.level.toUpperCase()}`);
  console.log(`   Large Text: ${result.combination.isLargeText ? 'Yes' : 'No'}`);
  console.log(`   Focus Indicator: ${result.combination.isFocusIndicator ? 'Yes' : 'No'}`);
  if (result.recommendations && result.recommendations.length > 0) {
    console.log('   Recommendations:');
    result.recommendations.forEach(rec => {
      console.log(`   • ${rec}`);
    });
  }
  console.log('');
});

// All combinations for reference
console.log('ALL COMBINATIONS:');
console.log('==================');
results.forEach((result, index) => {
  const status = result.result.wcag21AA ? '✅ PASS' : '❌ FAIL';
  const level = result.result.level.toUpperCase();
  console.log(`${index + 1}. ${status} [${level}] ${result.combination.context} (${result.result.ratio.toFixed(2)}:1)`);
});

console.log('\nRECOMMENDATIONS:');
console.log('=================');
report.recommendations.forEach((rec, index) => {
  console.log(`${index + 1}. ${rec}`);
});

export { results, report };