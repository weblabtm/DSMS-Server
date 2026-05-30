import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const root = path.resolve(__dirname, '..', 'prisma');
const headerPath = path.join(root, 'schema.header.prisma');
const outPath = path.join(root, 'schema.prisma');

// Look for per-module prisma files under src/modules/*/prisma/*.prisma
const modulesRoot = path.resolve(__dirname, '..', 'src', 'modules');

if (!fs.existsSync(headerPath)) {
    console.error('Missing prisma/schema.header.prisma (datasource + generator).');
    process.exit(2);
}

const header = fs.readFileSync(headerPath, 'utf8');

let moduleFiles = [];
if (fs.existsSync(modulesRoot)) {
    const moduleDirs = fs.readdirSync(modulesRoot, { withFileTypes: true })
        .filter(d => d.isDirectory())
        .map(d => path.join(modulesRoot, d.name));

    for (const modDir of moduleDirs) {
        const prismaDir = path.join(modDir, 'prisma');
        if (!fs.existsSync(prismaDir)) continue;
        const files = fs.readdirSync(prismaDir).filter(f => f.endsWith('.prisma'))
            .map(f => path.join(prismaDir, f));
        moduleFiles.push(...files);
    }
}

// Fallback: include any files in prisma/modules (legacy)
const legacyModulesDir = path.join(root, 'modules');
if (fs.existsSync(legacyModulesDir)) {
    const legacyFiles = fs.readdirSync(legacyModulesDir).filter(f => f.endsWith('.prisma'))
        .map(f => path.join(legacyModulesDir, f));
    moduleFiles.push(...legacyFiles);
}

moduleFiles = Array.from(new Set(moduleFiles)).sort();

const modulesContent = moduleFiles.map(f => {
    const displayName = path.relative(process.cwd(), f);
    return `\n// ===== ${displayName} =====\n` + fs.readFileSync(f, 'utf8');
}).join('\n');

fs.writeFileSync(outPath, header + '\n' + modulesContent, 'utf8');
console.log('Built', outPath);
