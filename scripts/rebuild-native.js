const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

console.log('🔧 Rebuilding native modules for target platform...');

const context = process.argv[2] ? JSON.parse(process.argv[2]) : {};
const { platform, arch } = context;

console.log(`Target: ${platform}-${arch}`);

// Define native modules that need rebuilding
const nativeModules = [
  '@serialport/bindings-cpp',
  'speaker'
];

try {
  // Clean existing builds
  console.log('🧹 Cleaning previous builds...');
  nativeModules.forEach(module => {
    const modulePath = path.join(__dirname, '..', 'node_modules', module);
    const buildPath = path.join(modulePath, 'build');
    
    if (fs.existsSync(buildPath)) {
      fs.rmSync(buildPath, { recursive: true, force: true });
      console.log(`  Cleaned: ${module}`);
    }
  });

  // Install electron-rebuild if not present
  try {
    require.resolve('electron-rebuild');
  } catch (e) {
    console.log('📦 Installing electron-rebuild...');
    execSync('npm install --save-dev electron-rebuild', { stdio: 'inherit' });
  }

  // Rebuild native modules for target platform
  console.log('🔨 Rebuilding native modules...');
  
  const electronVersion = require('../package.json').devDependencies.electron.replace('^', '');
  const rebuildCmd = `npx electron-rebuild --version=${electronVersion} --arch=${arch || 'x64'}`;
  
  console.log(`Running: ${rebuildCmd}`);
  execSync(rebuildCmd, { 
    stdio: 'inherit',
    cwd: path.join(__dirname, '..')
  });

  // Verify rebuilt modules
  console.log('✅ Verifying rebuilt modules...');
  nativeModules.forEach(module => {
    const modulePath = path.join(__dirname, '..', 'node_modules', module);
    const buildPath = path.join(modulePath, 'build');
    
    if (fs.existsSync(buildPath)) {
      console.log(`  ✓ ${module}: Build directory exists`);
      
      // Check for .node files
      const findNodeFiles = (dir) => {
        const files = fs.readdirSync(dir, { withFileTypes: true });
        let nodeFiles = [];
        
        files.forEach(file => {
          const fullPath = path.join(dir, file.name);
          if (file.isDirectory()) {
            nodeFiles = nodeFiles.concat(findNodeFiles(fullPath));
          } else if (file.name.endsWith('.node')) {
            nodeFiles.push(fullPath);
          }
        });
        
        return nodeFiles;
      };
      
      const nodeFiles = findNodeFiles(buildPath);
      if (nodeFiles.length > 0) {
        console.log(`  ✓ ${module}: Found ${nodeFiles.length} .node file(s)`);
        nodeFiles.forEach(file => {
          console.log(`    - ${path.relative(modulePath, file)}`);
        });
      } else {
        console.warn(`  ⚠ ${module}: No .node files found in build directory`);
      }
    } else {
      console.warn(`  ⚠ ${module}: Build directory not found`);
    }
  });

  console.log('🎉 Native modules rebuild completed!');

} catch (error) {
  console.error('❌ Failed to rebuild native modules:', error.message);
  console.error('Stack trace:', error.stack);
  process.exit(1);
} 