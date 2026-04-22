import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const target = path.resolve(__dirname, '../node_modules/@capacitor/android/capacitor/build.gradle');

if (!fs.existsSync(target)) {
  console.log('Skipping Capacitor Android patch: build.gradle not found');
  process.exit(0);
}

let source = fs.readFileSync(target, 'utf8');

source = source
  .replace(/compileSdk\s*=\s*project\.hasProperty\('compileSdkVersion'\) \? rootProject\.ext\.compileSdkVersion : \d+/g, "compileSdk = project.hasProperty('compileSdkVersion') ? rootProject.ext.compileSdkVersion : 34")
  .replace(/targetSdkVersion project\.hasProperty\('targetSdkVersion'\) \? rootProject\.ext\.targetSdkVersion : \d+/g, "targetSdkVersion project.hasProperty('targetSdkVersion') ? rootProject.ext.targetSdkVersion : 34")
  .replace(/sourceCompatibility JavaVersion\.VERSION_\d+/g, 'sourceCompatibility JavaVersion.VERSION_17')
  .replace(/targetCompatibility JavaVersion\.VERSION_\d+/g, 'targetCompatibility JavaVersion.VERSION_17');

if (!source.includes("force 'org.bouncycastle:bcprov-jdk18on:1.78.1'")) {
  source = source.replace(
    /repositories \{\n    google\(\)\n    mavenCentral\(\)\n\}/,
    `repositories {\n    google()\n    mavenCentral()\n}\n\nconfigurations.all {\n    resolutionStrategy {\n        force 'org.bouncycastle:bcprov-jdk18on:1.78.1'\n        force 'org.bouncycastle:bcpkix-jdk18on:1.78.1'\n\n        dependencySubstitution {\n            substitute module('org.bouncycastle:bcprov-jdk18on:1.79') using module('org.bouncycastle:bcprov-jdk18on:1.78.1')\n            substitute module('org.bouncycastle:bcpkix-jdk18on:1.79') using module('org.bouncycastle:bcpkix-jdk18on:1.78.1')\n            substitute module('org.bouncycastle:bcprov-jdk15on') using module('org.bouncycastle:bcprov-jdk18on:1.78.1')\n            substitute module('org.bouncycastle:bcpkix-jdk15on') using module('org.bouncycastle:bcpkix-jdk18on:1.78.1')\n        }\n\n        eachDependency { DependencyResolveDetails details ->\n            if (details.requested.group == 'org.bouncycastle') {\n                details.useVersion '1.78.1'\n            }\n        }\n    }\n}`
  );
}

fs.writeFileSync(target, source);
console.log('Patched Capacitor Android build.gradle for BouncyCastle 1.78.1, SDK 34, and Java 17');