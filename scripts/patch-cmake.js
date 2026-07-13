#!/usr/bin/env node
/**
 * Postinstall script: add c++_shared to CMakeLists.txt files that are
 * missing it. Needed because NDK 27 does not auto-link libc++_shared.so
 * through the c++_shared STL setting alone — each shared lib target must
 * declare it explicitly.
 *
 * patch-package cannot be used on Windows for these packages because their
 * build-cache directories (.cxx/) have paths exceeding MAX_PATH.
 */

const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");

const patches = [
  // react-native-worklets: add c++_shared before closing paren of target_link_libraries
  {
    file: "node_modules/react-native-worklets/android/CMakeLists.txt",
    search: /target_link_libraries\(worklets android log ReactAndroid::reactnative\s*\n\s*ReactAndroid::jsi fbjni::fbjni\)/,
    replace:
      "target_link_libraries(worklets android log ReactAndroid::reactnative\n" +
      "                      ReactAndroid::jsi fbjni::fbjni c++_shared)",
  },
  // react-native-screens: add c++_shared to target_link_libraries block
  {
    file: "node_modules/react-native-screens/android/CMakeLists.txt",
    search: /target_link_libraries\(rnscreens\s*\n\s*ReactAndroid::reactnative\s*\n\s*ReactAndroid::jsi\s*\n\s*fbjni::fbjni\s*\n\s*android\s*\n\)/,
    replace:
      "target_link_libraries(rnscreens\n" +
      "    ReactAndroid::reactnative\n" +
      "    ReactAndroid::jsi\n" +
      "    fbjni::fbjni\n" +
      "    android\n" +
      "    c++_shared\n" +
      ")",
  },
  // expo-modules-core: add c++_shared (already handled inline in main.cmake)
  {
    file: "node_modules/expo-modules-core/android/cmake/main.cmake",
    search: /target_link_libraries\(\s*expo-modules-core\s*\n\s*PRIVATE\s*\n\s*\$\{LOG_LIB\}\s*\n\s*android\s*\n/,
    replace:
      "target_link_libraries(\n" +
      "  expo-modules-core\n" +
      "  PRIVATE\n" +
      "  ${LOG_LIB}\n" +
      "  android\n" +
      "  c++_shared\n",
  },
  // expo-sqlite: add c++_shared
  {
    file: "node_modules/expo-sqlite/android/CMakeLists.txt",
    search: /target_link_libraries\(\s*\n\s*\$\{PACKAGE_NAME\}\s*\n\s*\$\{LOG_LIB\}\s*\n\s*\$\{OPENSSL_CRYPTO_LIB\}\s*\n\s*\$\{LIBSQL_LIB\}\s*\n\s*fbjni::fbjni\s*\n\s*android\s*\n\)/,
    replace:
      "target_link_libraries(\n" +
      "  ${PACKAGE_NAME}\n" +
      "  ${LOG_LIB}\n" +
      "  ${OPENSSL_CRYPTO_LIB}\n" +
      "  ${LIBSQL_LIB}\n" +
      "  fbjni::fbjni\n" +
      "  android\n" +
      "  c++_shared\n" +
      ")",
  },
  // react-native-reanimated: add c++_shared
  {
    file: "node_modules/react-native-reanimated/android/CMakeLists.txt",
    search: /target_link_libraries\(\s*\n\s*reanimated\s*\n\s*log\s*\n\s*ReactAndroid::reactnative\s*\n\s*ReactAndroid::jsi\s*\n\s*fbjni::fbjni\s*\n\s*android\s*\n\s*react-native-worklets::worklets\)/,
    replace:
      "target_link_libraries(\n" +
      "  reanimated\n" +
      "  log\n" +
      "  ReactAndroid::reactnative\n" +
      "  ReactAndroid::jsi\n" +
      "  fbjni::fbjni\n" +
      "  android\n" +
      "  c++_shared\n" +
      "  react-native-worklets::worklets)",
  },
  // react-native core: add c++_shared to common_flags interface
  {
    file: "node_modules/react-native/ReactAndroid/cmake-utils/ReactNative-application.cmake",
    search:
      "add_library(common_flags INTERFACE)\ntarget_compile_options(common_flags INTERFACE ${folly_FLAGS})\n",
    replace:
      "add_library(common_flags INTERFACE)\n" +
      "target_compile_options(common_flags INTERFACE ${folly_FLAGS})\n" +
      "target_link_libraries(common_flags INTERFACE c++_shared)\n",
  },
];

let appliedCount = 0;

for (const patch of patches) {
  const filePath = path.join(root, patch.file);
  if (!fs.existsSync(filePath)) {
    console.log(`[patch-cmake] SKIP (not found): ${patch.file}`);
    continue;
  }

  let content = fs.readFileSync(filePath, "utf8");

  // Check if already patched
  if (content.includes("c++_shared")) {
    console.log(`[patch-cmake] already patched: ${patch.file}`);
    continue;
  }

  const patched =
    typeof patch.search === "string"
      ? content.replace(patch.search, patch.replace)
      : content.replace(patch.search, patch.replace);

  if (patched === content) {
    console.warn(`[patch-cmake] WARNING: pattern not matched in ${patch.file}`);
    continue;
  }

  fs.writeFileSync(filePath, patched, "utf8");
  console.log(`[patch-cmake] patched: ${patch.file}`);
  appliedCount++;
}

console.log(`[patch-cmake] done (${appliedCount} files modified)`);
