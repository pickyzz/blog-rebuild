#!/usr/bin/env node

/**
 * Environment Verification Script
 *
 * This script detects the current environment and validates
 * that all required environment variables are properly set.
 *
 * Usage:
 *   node scripts/verify-env.mjs           # Full diagnostic
 *   node scripts/verify-env.mjs --check    # Check only (exit 0/1)
 *   node scripts/verify-env.mjs --export   # Export config as JSON
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.join(__dirname, '..');

// Environment detection patterns
const ENVIRONMENT_PATTERNS = {
  'Vercel': {
    envVars: ['VERCEL', 'VERCEL_ENV'],
    required: ['VERCEL'],
    ui: 'Vercel Dashboard → Project Settings → Environment Variables'
  },
  'Netlify': {
    envVars: ['NETLIFY', 'NETLIFY_BUILD_ID'],
    required: ['NETLIFY'],
    ui: 'Netlify Dashboard → Site settings → Build & deploy → Environment'
  },
  'Cloudflare Pages': {
    envVars: ['CF_PAGES', 'CLOUDFLARE_PAGES'],
    required: ['CF_PAGES'],
    ui: 'Cloudflare Dashboard → Pages → Settings → Environment variables'
  },
  'GitHub Actions': {
    envVars: ['GITHUB_ACTIONS', 'GITHUB_WORKFLOW'],
    required: ['GITHUB_ACTIONS'],
    ui: 'GitHub Repository → Settings → Secrets and variables → Actions'
  },
  'Local Development': {
    envVars: ['NODE_ENV'],
    checkFile: '.env'
  }
};

// Required and optional environment variables
const REQUIRED_VARS = [
  'NOTION_KEY',
  'DATABASE_ID'
];

const OPTIONAL_VARS = [
  'NODE_ENV',
  'UPSTASH_REDIS_REST_URL',
  'UPSTASH_REDIS_REST_TOKEN',
  'API_SECRET_KEY',
  'WEBHOOK_SECRET',
  'SCHEDULED_REFRESH_KEY',
  'NOTION_API_RATE_LIMIT',
  'NOTION_RETRY_ATTEMPTS',
  'IMAGE_PLACEHOLDER_WIDTH',
  'IMAGE_PLACEHOLDER_QUALITY',
  'DEBUG_SYNC_PROCESSING'
];

class EnvironmentVerifier {
  constructor() {
    this.env = { ...process.env };
    this.detectedEnv = this.detectEnvironment();
  }

  detectEnvironment() {
    for (const [envName, config] of Object.entries(ENVIRONMENT_PATTERNS)) {
      if (config.required?.every(varName => this.env[varName]) ||
          config.envVars?.some(varName => this.env[varName])) {
        return envName;
      }
    }
    return 'Unknown';
  }

  async hasLocalEnv() {
    try {
      const envPath = path.join(projectRoot, '.env');
      await fs.access(envPath);
      return true;
    } catch {
      return false;
    }
  }

  getEnvironmentInfo() {
    return {
      environment: this.detectedEnv,
      isCI: this.isCI(),
      isProduction: this.isProduction(),
      isDevelopment: this.isDevelopment(),
      hasLocalEnv: this.detectedEnv === 'Local Development' ? await this.hasLocalEnv() : false,
      nodeEnv: this.env.NODE_ENV || 'development'
    };
  }

  isCI() {
    return this.env.CI === 'true' ||
           this.env.GITHUB_ACTIONS === 'true' ||
           this.env.VERCEL === '1' ||
           this.env.NETLIFY === 'true';
  }

  isProduction() {
    return this.env.NODE_ENV === 'production' ||
           this.env.VERCEL_ENV === 'production' ||
           this.env.CF_PAGES_BRANCH === 'main';
  }

  isDevelopment() {
    return this.env.NODE_ENV === 'development' ||
           this.env.NODE_ENV === undefined ||
           this.detectedEnv === 'Local Development';
  }

  validateEnvironment() {
    const missing = [];
    const present = [];
    const warnings = [];

    // Check required variables
    for (const varName of REQUIRED_VARS) {
      if (this.env[varName]) {
        present.push(varName);
      } else {
        missing.push(varName);
      }
    }

    // Check optional variables
    for (const varName of OPTIONAL_VARS) {
      if (this.env[varName]) {
        present.push(varName);
      } else {
        warnings.push(varName);
      }
    }

    // Environment-specific checks
    if (this.detectedEnv === 'Local Development') {
      if (!this.hasLocalEnv) {
        warnings.push('LOCAL_ENV_FILE');
      }
    }

    return {
      isValid: missing.length === 0,
      hasRequired: REQUIRED_VARS.every(v => this.env[v]),
      missing,
      present,
      warnings
    };
  }

  getSolution(variables) {
    const env = this.detectedEnv;

    const solutions = {
      'Vercel': {
        command: 'vercel env add',
        ui: 'Vercel Dashboard → Project Settings → Environment Variables',
        example: variables.map(v => `vercel env add ${v}`).join(' && ')
      },
      'Netlify': {
        command: 'netlify env:set',
        ui: 'Netlify Dashboard → Site settings → Build & deploy → Environment',
        example: variables.map(v => `netlify env:set ${v} value`).join(' && ')
      },
      'Cloudflare Pages': {
        command: 'wrangler pages secret',
        ui: 'Cloudflare Dashboard → Pages → Settings → Environment variables',
        example: variables.map(v => `wrangler pages secret put ${v}`).join(' && ')
      },
      'GitHub Actions': {
        command: 'gh secret set',
        ui: 'GitHub Repository → Settings → Secrets and variables → Actions',
        example: variables.map(v => `gh secret set ${v}`).join(' && ')
      },
      'Local Development': {
        command: 'Edit .env file',
        ui: 'Edit .env file in project root',
        example: variables.map(v => `${v}=your_value_here`).join('\n')
      }
    };

    return solutions[env] || solutions['Local Development'];
  }

  printDiagnostic() {
    const envInfo = this.getEnvironmentInfo();
    const validation = this.validateEnvironment();

    console.log('🔍 Environment Verification Results:');
    console.log('=================================');
    console.log(`Environment: ${envInfo.environment}`);
    console.log(`CI/CD: ${envInfo.isCI ? 'Yes' : 'No'}`);
    console.log(`Production: ${envInfo.isProduction ? 'Yes' : 'No'}`);
    console.log(`Development: ${envInfo.isDevelopment ? 'Yes' : 'No'}`);
    if (envInfo.hasLocalEnv) {
      console.log(`Local .env: Yes`);
    }
    console.log('');

    if (validation.isValid) {
      console.log('✅ Environment is properly configured!');
    } else {
      console.log('❌ Environment has issues:');
      console.log('');

      if (validation.missing.length > 0) {
        console.log('❌ Missing Required Variables:');
        validation.missing.forEach(v => console.log(`   - ${v}`));
        console.log('');

        const solution = this.getSolution(validation.missing);
        console.log('🔧 Solution:');
        console.log(`   UI: ${solution.ui}`);
        console.log(`   Command: ${solution.command}`);
        if (solution.example) {
          console.log(`   Example: ${solution.example}`);
        }
        console.log('');
      }

      if (validation.warnings.length > 0) {
        console.log('⚠️  Warnings:');
        validation.warnings.forEach(v => {
          if (v === 'LOCAL_ENV_FILE') {
            console.log('   - .env file not found in project root');
          } else {
            console.log(`   - Optional variable not set: ${v}`);
          }
        });
        console.log('');
      }
    }

    // Print environment variables summary
    this.printEnvSummary(validation);
  }

  printEnvSummary(validation) {
    console.log('📋 Environment Variables Summary:');
    console.log('=================================');

    console.log('✅ Present Required:');
    const presentRequired = REQUIRED_VARS.filter(v => validation.present.includes(v));
    presentRequired.forEach(v => {
      const masked = this.maskValue(this.env[v]);
      console.log(`   ${v}: ${masked}`);
    });

    if (validation.missing.length > 0) {
      console.log('❌ Missing Required:');
      validation.missing.forEach(v => console.log(`   ${v}: <not set>`));
    }

    const presentOptional = OPTIONAL_VARS.filter(v => validation.present.includes(v));
    if (presentOptional.length > 0) {
      console.log('ℹ️  Present Optional:');
      presentOptional.forEach(v => {
        const masked = this.maskValue(this.env[v]);
        console.log(`   ${v}: ${masked}`);
      });
    }

    const missingOptional = OPTIONAL_VARS.filter(v => !validation.present.includes(v));
    if (missingOptional.length > 0) {
      console.log('⚠️  Missing Optional:');
      missingOptional.slice(0, 5).forEach(v => console.log(`   ${v}: <not set>`));
      if (missingOptional.length > 5) {
        console.log(`   ... and ${missingOptional.length - 5} more`);
      }
    }
  }

  maskValue(value) {
    if (!value) return '';

    const strValue = String(value);

    // Mask sensitive values
    if (strValue.toLowerCase().includes('secret') ||
        strValue.toLowerCase().includes('key') ||
        strValue.toLowerCase().includes('token')) {
      return strValue.substring(0, 8) + '...';
    }

    // Show first and last few characters for long values
    if (strValue.length > 30) {
      return strValue.substring(0, 12) + '...' + strValue.substring(strValue.length - 8);
    }

    return strValue;
  }

  exportConfig() {
    const envInfo = this.getEnvironmentInfo();
    const validation = this.validateEnvironment();

    return {
      environment: envInfo,
      validation: {
        isValid: validation.isValid,
        hasRequired: validation.hasRequired,
        missing: validation.missing,
        present: validation.present,
        warnings: validation.warnings
      },
      // Export only safe, non-sensitive values
      env: {
        NODE_ENV: this.env.NODE_ENV || 'development',
        NOTION_API_RATE_LIMIT: this.env.NOTION_API_RATE_LIMIT || '5',
        NOTION_RETRY_ATTEMPTS: this.env.NOTION_RETRY_ATTEMPTS || '3',
        IMAGE_PLACEHOLDER_WIDTH: this.env.IMAGE_PLACEHOLDER_WIDTH || '32',
        IMAGE_PLACEHOLDER_QUALITY: this.env.IMAGE_PLACEHOLDER_QUALITY || '30',
        DEBUG_SYNC_PROCESSING: this.env.DEBUG_SYNC_PROCESSING || 'false'
      }
    };
  }
}

// CLI execution
async function main() {
  const command = process.argv[2];
  const verifier = new EnvironmentVerifier();

  switch (command) {
    case '--check':
      const validation = verifier.validateEnvironment();
      console.log(validation.isValid ? 'VALID' : 'INVALID');
      process.exit(validation.isValid ? 0 : 1);

    case '--export':
      const config = verifier.exportConfig();
      console.log(JSON.stringify(config, null, 2));
      break;

    case '--quiet':
      const quietValidation = verifier.validateEnvironment();
      process.exit(quietValidation.isValid ? 0 : 1);

    default:
      verifier.printDiagnostic();
  }
}

// Export as module for use in other scripts
export default EnvironmentVerifier;

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    console.error('❌ Environment verification failed:', error.message);
    process.exit(1);
  });
}
