// Environment detection and validation script
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.join(__dirname, '..', '..');

// Environment configuration with detection patterns
const ENVIRONMENT_CONFIG = {
  'Vercel': {
    envVars: ['VERCEL', 'VERCEL_ENV'],
    buildDir: '.vercel',
    files: ['vercel.json']
  },
  'Netlify': {
    envVars: ['NETlify', 'NETLIFY_BUILD_ID'],
    buildDir: '.netlify',
    files: ['netlify.toml']
  },
  'Cloudflare Pages': {
    envVars: ['CF_PAGES', 'CLOUDFLARE_PAGES'],
    buildDir: '.wrangler',
    files: ['wrangler.toml']
  },
  'GitHub Actions': {
    envVars: ['GITHUB_ACTIONS', 'GITHUB_WORKFLOW'],
    buildDir: '.github',
    files: ['.github/workflows']
  },
  'Vercel CLI': {
    envVars: ['VERCEL_CLI'],
    buildDir: '.vercel',
    files: ['vercel.json']
  }
};

// Required environment variables
const REQUIRED_ENV_VARS = [
  'NOTION_KEY',
  'DATABASE_ID'
];

// Optional environment variables
const OPTIONAL_ENV_VARS = [
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

class EnvironmentDetector {
  constructor() {
    this.env = { ...process.env };
    this.detectedEnv = this.detectEnvironment();
  }

  detectEnvironment() {
    for (const [envName, config] of Object.entries(ENVIRONMENT_CONFIG)) {
      if (config.envVars.some(envVar => this.env[envVar])) {
        return envName;
      }
    }

    // Check for local .env file
    if (this.hasLocalEnv()) {
      return 'Local Development';
    }

    return 'Unknown';
  }

  hasLocalEnv() {
    try {
      const envPath = path.join(projectRoot, '.env');
      const envExamplePath = path.join(projectRoot, '.example.env');

      return fs.access(envPath).then(() => true).catch(() => false);
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
      buildDir: this.getBuildDir()
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

  getBuildDir() {
    const config = ENVIRONMENT_CONFIG[this.detectedEnv];
    return config?.buildDir || '.vercel';
  }

  validateEnvironment() {
    const missing = [];
    const warnings = [];
    const info = [];

    // Check required variables
    for (const varName of REQUIRED_ENV_VARS) {
      if (!this.env[varName]) {
        missing.push(varName);
      }
    }

    // Check optional variables
    for (const varName of OPTIONAL_ENV_VARS) {
      if (!this.env[varName]) {
        warnings.push(varName);
      }
    }

    // Environment-specific checks
    if (this.detectedEnv === 'Vercel' || this.detectedEnv === 'Vercel CLI') {
      if (!this.env.VERCEL) {
        warnings.push('VERCEL');
      }
    }

    if (this.detectedEnv === 'Local Development') {
      if (!this.hasLocalEnv()) {
        warnings.push('.env file not found');
      }
    }

    return {
      isValid: missing.length === 0,
      missing,
      warnings,
      info,
      recommendations: this.getRecommendations(missing, warnings)
    };
  }

  getRecommendations(missing, warnings) {
    const recommendations = [];

    if (missing.length > 0) {
      recommendations.push({
        type: 'error',
        title: 'Missing Required Environment Variables',
        message: `Please set these variables: ${missing.join(', ')}`,
        solution: this.getEnvSolution(missing)
      });
    }

    if (this.detectedEnv === 'Local Development' && !this.hasLocalEnv()) {
      recommendations.push({
        type: 'warning',
        title: 'Local Environment Not Configured',
        message: 'Create a .env file from .example.env',
        solution: 'cp .example.env .env && nano .env'
      });
    }

    if (warnings.length > 0 && !this.isDevelopment()) {
      recommendations.push({
        type: 'info',
        title: 'Optional Variables Missing',
        message: `Optional variables not set: ${warnings.slice(0, 3).join(', ')}...`,
        solution: 'Check .example.env for all available options'
      });
    }

    return recommendations;
  }

  getEnvSolution(missingVars) {
    const solutions = {};

    if (this.detectedEnv === 'Vercel' || this.detectedEnv === 'Vercel CLI') {
      solutions.command = 'vercel env add';
      solutions.ui = 'Vercel Dashboard → Settings → Environment Variables';
      solutions.variables = missingVars.map(v => `vercel env add ${v}`);
    } else if (this.detectedEnv === 'Netlify') {
      solutions.command = 'netlify env:set';
      solutions.ui = 'Netlify Dashboard → Site settings → Environment variables';
      solutions.variables = missingVars.map(v => `netlify env:set ${v} value`);
    } else if (this.detectedEnv === 'Local Development') {
      solutions.command = 'Edit .env file';
      solutions.ui = 'nano .env';
      solutions.variables = missingVars.map(v => `${v}=your_value_here`);
    } else {
      solutions.command = 'Set environment variables for your platform';
      solutions.ui = 'Check your deployment platform documentation';
      solutions.variables = missingVars;
    }

    return solutions;
  }

  async loadEnvFile() {
    if (this.detectedEnv !== 'Local Development') {
      return;
    }

    try {
      const envPath = path.join(projectRoot, '.env');
      const envContent = await fs.readFile(envPath, 'utf-8');

      const lines = envContent.split('\n');
      const envVars = {};

      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('#')) {
          const [key, ...valueParts] = trimmed.split('=');
          if (key && valueParts.length > 0) {
            envVars[key.trim()] = valueParts.join('=').trim();
          }
        }
      }

      // Merge with existing environment
      Object.assign(this.env, envVars);

    } catch (error) {
      console.warn('⚠️  Could not load .env file:', error.message);
    }
  }

  printDiagnostic() {
    const envInfo = this.getEnvironmentInfo();
    const validation = this.validateEnvironment();

    console.log('🔍 Environment Detection Results:');
    console.log('====================================');
    console.log(`Environment: ${envInfo.environment}`);
    console.log(`CI/CD: ${envInfo.isCI ? 'Yes' : 'No'}`);
    console.log(`Production: ${envInfo.isProduction ? 'Yes' : 'No'}`);
    console.log(`Development: ${envInfo.isDevelopment ? 'Yes' : 'No'}`);
    console.log(`Build Directory: ${envInfo.buildDir}`);
    console.log('');

    if (validation.isValid) {
      console.log('✅ Environment is properly configured!');
    } else {
      console.log('❌ Environment has issues:');
      console.log('');

      validation.recommendations.forEach(rec => {
        const icon = rec.type === 'error' ? '❌' : rec.type === 'warning' ? '⚠️' : 'ℹ️';
        console.log(`${icon} ${rec.title}`);
        console.log(`   ${rec.message}`);
        console.log(`   Solution: ${rec.solution}`);
        console.log('');
      });
    }

    // Print environment variables summary
    console.log('📋 Environment Variables Summary:');
    console.log('====================================');

    const presentRequired = REQUIRED_ENV_VARS.filter(v => this.env[v]);
    const missingRequired = REQUIRED_ENV_VARS.filter(v => !this.env[v]);

    if (presentRequired.length > 0) {
      console.log('✅ Present Required:');
      presentRequired.forEach(v => console.log(`   ${v}: ${this.maskValue(this.env[v], v)}`));
    }

    if (missingRequired.length > 0) {
      console.log('❌ Missing Required:');
      missingRequired.forEach(v => console.log(`   ${v}: <not set>`));
    }

    const presentOptional = OPTIONAL_ENV_VARS.filter(v => this.env[v]);
    const missingOptional = OPTIONAL_ENV_VARS.filter(v => !this.env[v]);

    if (presentOptional.length > 0) {
      console.log('ℹ️  Present Optional:');
      presentOptional.forEach(v => console.log(`   ${v}: ${this.maskValue(this.env[v], v)}`));
    }

    if (missingOptional.length > 0 && !this.isDevelopment()) {
      console.log('⚠️  Missing Optional:');
      missingOptional.slice(0, 5).forEach(v => console.log(`   ${v}: <not set>`));
      if (missingOptional.length > 5) {
        console.log(`   ... and ${missingOptional.length - 5} more`);
      }
    }
  }

  maskValue(value, key = '') {
    if (!value) return '';

    // Always completely mask known sensitive keys regardless of value content
    const sensitiveKeys = ['KEY', 'TOKEN', 'SECRET', 'PASSWORD', 'CREDENTIAL'];
    if (sensitiveKeys.some(s => key.toUpperCase().includes(s))) {
       return '********';
    }

    // Also mask if the value itself looks like a secret/key/token
    if (value.includes('secret') || value.includes('key') || value.includes('token') || value.length > 50) {
      return '********';
    }
    
    // For other values, show only safe ends
    if (value.length > 20) {
      return value.substring(0, 4) + '***' + value.substring(value.length - 4);
    }

    return value;
  }

  exportConfig() {
    const validation = this.validateEnvironment();

    return {
      environment: this.getEnvironmentInfo(),
      validation: {
        isValid: validation.isValid,
        hasRequired: REQUIRED_ENV_VARS.every(v => this.env[v]),
        requiredVars: REQUIRED_ENV_VARS.filter(v => this.env[v]),
        missingVars: REQUIRED_ENV_VARS.filter(v => !this.env[v]),
        optionalVars: OPTIONAL_ENV_VARS.filter(v => this.env[v])
      },
      recommendations: validation.recommendations,
      env: {
        // Export only safe, non-sensitive values
        NODE_ENV: this.env.NODE_ENV,
        NOTION_API_RATE_LIMIT: this.env.NOTION_API_RATE_LIMIT || '5',
        NOTION_RETRY_ATTEMPTS: this.env.NOTION_RETRY_ATTEMPTS || '3',
        IMAGE_PLACEHOLDER_WIDTH: this.env.IMAGE_PLACEHOLDER_WIDTH || '32',
        IMAGE_PLACEHOLDER_QUALITY: this.env.IMAGE_PLACEHOLDER_QUALITY || '30',
        DEBUG_SYNC_PROCESSING: this.env.DEBUG_SYNC_PROCESSING || 'false'
      }
    };
  }
}

// Export as default
export default EnvironmentDetector;

// CLI usage
if (import.meta.url === `file://${process.argv[1]}`) {
  const detector = new EnvironmentDetector();

  // Load .env file for local development
  await detector.loadEnvFile();

  // Check command line arguments
  const command = process.argv[2];

  switch (command) {
    case '--check':
      const validation = detector.validateEnvironment();
      process.exit(validation.isValid ? 0 : 1);

    case '--export':
      console.log(JSON.stringify(detector.exportConfig(), null, 2));
      break;

    case '--env':
      console.log(detector.detectedEnv);
      break;

    case '--help':
      console.log(`
Environment Detection Tool

Usage: node detectEnv.mjs [command]

Commands:
  (no args)     Show full diagnostic
  --check         Check if environment is valid (exit code 0/1)
  --export        Export configuration as JSON
  --env           Show detected environment only
  --help          Show this help message

Examples:
  node detectEnv.mjs
  node detectEnv.mjs --check
  node detectEnv.mjs --export
      `);
      break;

    default:
      detector.printDiagnostic();
  }
}
