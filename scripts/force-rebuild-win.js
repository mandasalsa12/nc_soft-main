const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🔧 Force rebuilding native modules for Windows target...');

const NATIVE_MODULES = [
  '@serialport/bindings-cpp',
  'speaker'
];

const ELECTRON_VERSION = '28.3.3';

try {
  // Clean existing builds
  console.log('🧹 Cleaning existing builds...');
  NATIVE_MODULES.forEach(module => {
    const buildPath = path.join(__dirname, '..', 'node_modules', module, 'build');
    if (fs.existsSync(buildPath)) {
      fs.rmSync(buildPath, { recursive: true, force: true });
      console.log(`  Cleaned: ${module}/build`);
    }
  });

  // Force rebuild with Electron headers for Windows
  console.log('🔨 Rebuilding native modules for Electron Windows...');
  
  const env = {
    ...process.env,
    npm_config_target: ELECTRON_VERSION,
    npm_config_arch: 'x64',
    npm_config_target_arch: 'x64',
    npm_config_disturl: 'https://electronjs.org/headers',
    npm_config_runtime: 'electron',
    npm_config_target_platform: 'win32',
    npm_config_platform: 'win32',
    npm_config_cache: '/tmp/.npm'
  };

  // Use electron-rebuild specifically for each module
  NATIVE_MODULES.forEach(module => {
    try {
      console.log(`🔨 Rebuilding ${module}...`);
      execSync(
        `npx @electron/rebuild --module-dir node_modules/${module} --version ${ELECTRON_VERSION} --arch x64 --platform win32 --force`,
        { 
          stdio: 'inherit',
          env: env
        }
      );
      console.log(`✅ Successfully rebuilt ${module}`);
    } catch (error) {
      console.warn(`⚠️  Failed to rebuild ${module}: ${error.message}`);
      console.log('Trying alternative rebuild method...');
      
      try {
        execSync(
          `cd node_modules/${module} && npm run install --target=${ELECTRON_VERSION} --arch=x64 --target_arch=x64 --disturl=https://electronjs.org/headers --runtime=electron`,
          { 
            stdio: 'inherit',
            env: env
          }
        );
        console.log(`✅ Successfully rebuilt ${module} (alternative method)`);
      } catch (altError) {
        console.error(`❌ Failed to rebuild ${module} with alternative method: ${altError.message}`);
      }
    }
  });

  console.log('🎉 Native module rebuild completed!');

} catch (error) {
  console.error('❌ Error during rebuild:', error.message);
  process.exit(1);
} 