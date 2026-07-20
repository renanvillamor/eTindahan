const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const root = path.resolve(__dirname, "..");
const prepareOnly = process.argv.includes("--prepare-only");

function commandName(base) {
  return process.platform === "win32" ? `${base}.cmd` : base;
}

function run(command, args, cwd) {
  // On Windows, spawning a .cmd/.bat directly with shell:false throws
  // EINVAL — it needs to go through a shell to be resolved/executed.
  const needsShell =
    process.platform === "win32" && /\.(cmd|bat)$/i.test(command);

  const result = spawnSync(command, args, {
    cwd,
    stdio: "inherit",
    shell: needsShell,
  });

  if (result.error) {
    console.error(`Failed to run "${command} ${args.join(" ")}":`);
    console.error(result.error.message);
    process.exit(1);
  }

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function updateText(text, replacements, relPath) {
  let next = text;

  for (const { from, to } of replacements) {
    if (next.includes(to)) {
      continue;
    }

    if (!next.includes(from)) {
      throw new Error(`Patch pattern not found in ${relPath}`);
    }

    next = next.replace(from, to);
  }

  return next;
}

function patchFile(relPath, replacements, options = {}) {
  const filePath = path.join(root, relPath);
  if (!fs.existsSync(filePath)) {
    if (options.optional) {
      return false;
    }
    throw new Error(`Missing file: ${relPath}`);
  }

  const current = fs.readFileSync(filePath, "utf8");
  const next = updateText(current, replacements, relPath);

  if (next !== current) {
    fs.writeFileSync(filePath, next, "utf8");
    return true;
  }

  return false;
}

function ensureAndroidProject() {
  const androidDir = path.join(root, "android");
  if (fs.existsSync(androidDir)) {
    return;
  }

  run(commandName("npx"), ["expo", "prebuild", "--platform", "android"], root);
}

function prepare() {
  ensureAndroidProject();

  const updates = [
    {
      relPath: "android/build.gradle",
      replacements: [
        {
          from: `allprojects {\n  repositories {\n    google()\n    mavenCentral()\n    maven { url 'https://www.jitpack.io' }\n  }\n}\n\napply plugin: "expo-root-project"\napply plugin: "com.facebook.react.rootproject"\n`,
          to: `allprojects {\n  repositories {\n    google()\n    mavenCentral()\n    maven { url 'https://www.jitpack.io' }\n  }\n}\n\next {\n    compileSdkVersion = 35\n    targetSdkVersion = 35\n    buildToolsVersion = "35.0.0"\n    ndkVersion = "27.1.12297006"\n}\n\napply plugin: "expo-root-project"\napply plugin: "com.facebook.react.rootproject"\n\nsubprojects {\n  tasks.matching { task ->\n    task.name == "lintVitalAnalyzeRelease" || task.name == "lintAnalyzeRelease"\n  }.configureEach {\n    enabled = false\n  }\n}\n`,
        },
      ],
    },
    {
      relPath: "android/gradle.properties",
      replacements: [
        {
          from: "reactNativeArchitectures=armeabi-v7a,arm64-v8a,x86,x86_64",
          to: "reactNativeArchitectures=arm64-v8a",
        },
      ],
    },
    {
      relPath:
        "node_modules/react-native-gesture-handler/android/src/main/jni/CMakeLists.txt",
      replacements: [
        {
          from: `target_link_libraries(\n  \${PACKAGE_NAME}\n  ReactAndroid::reactnative\n  ReactAndroid::jsi\n  fbjni::fbjni\n)\n`,
          to: `target_link_libraries(\n  \${PACKAGE_NAME}\n  ReactAndroid::reactnative\n  ReactAndroid::jsi\n  fbjni::fbjni\n  c++_shared\n)\n`,
        },
      ],
    },
    {
      relPath: "node_modules/react-native-worklets/android/CMakeLists.txt",
      replacements: [
        {
          from: "target_link_libraries(worklets log ReactAndroid::jsi fbjni::fbjni)",
          to: "target_link_libraries(worklets log ReactAndroid::jsi fbjni::fbjni c++_shared)",
        },
        {
          from: "target_link_libraries(worklets ReactAndroid::reactnative)",
          to: "target_link_libraries(worklets ReactAndroid::reactnative c++_shared)",
        },
        {
          from: "    worklets ReactAndroid::react_nativemodule_core ReactAndroid::folly_runtime\n    ReactAndroid::glog ReactAndroid::reactnativejni)",
          to: "    worklets ReactAndroid::react_nativemodule_core ReactAndroid::folly_runtime\n    ReactAndroid::glog ReactAndroid::reactnativejni c++_shared)",
        },
      ],
    },
    {
      relPath: "node_modules/react-native-reanimated/android/CMakeLists.txt",
      replacements: [
        {
          from: `target_link_libraries(reanimated log ReactAndroid::jsi fbjni::fbjni android\n                      worklets)`,
          to: `target_link_libraries(reanimated log ReactAndroid::jsi fbjni::fbjni android\n                      worklets c++_shared)`,
        },
        {
          from: "  target_link_libraries(reanimated ReactAndroid::reactnative)",
          to: "  target_link_libraries(reanimated ReactAndroid::reactnative c++_shared)",
        },
        {
          from: "  target_link_libraries(reanimated ReactAndroid::react_nativemodule_core)",
          to: "  target_link_libraries(reanimated ReactAndroid::react_nativemodule_core c++_shared)",
        },
      ],
    },
    {
      relPath: "node_modules/react-native-screens/android/CMakeLists.txt",
      replacements: [
        {
          from: `        target_link_libraries(rnscreens\n            ReactAndroid::reactnative\n            ReactAndroid::jsi\n            fbjni::fbjni\n            android\n        )`,
          to: `        target_link_libraries(rnscreens\n            ReactAndroid::reactnative\n            ReactAndroid::jsi\n            fbjni::fbjni\n            c++_shared\n            android\n        )`,
        },
        {
          from: `                ReactAndroid::react_render_observers_events\n                fbjni::fbjni\n                android\n        )`,
          to: `                ReactAndroid::react_render_observers_events\n                fbjni::fbjni\n                c++_shared\n                android\n        )`,
        },
        {
          from: `    target_link_libraries(rnscreens\n        ReactAndroid::jsi\n        android\n    )`,
          to: `    target_link_libraries(rnscreens\n        ReactAndroid::jsi\n        c++_shared\n        android\n    )`,
        },
      ],
    },
    {
      relPath:
        "node_modules/react-native-screens/android/src/main/jni/CMakeLists.txt",
      replacements: [
        {
          from: `  target_link_libraries(\n    \${LIB_TARGET_NAME}\n    ReactAndroid::reactnative\n    ReactAndroid::jsi\n    fbjni::fbjni\n  )`,
          to: `  target_link_libraries(\n    \${LIB_TARGET_NAME}\n    ReactAndroid::reactnative\n    ReactAndroid::jsi\n    fbjni::fbjni\n    c++_shared\n  )`,
        },
        {
          from: `    glog\n    jsi\n    react_codegen_rncore`,
          to: `    glog\n    jsi\n    c++_shared\n    react_codegen_rncore`,
        },
      ],
    },
    {
      relPath:
        "node_modules/react-native-safe-area-context/android/src/main/jni/CMakeLists.txt",
      replacements: [
        {
          from: `  target_link_libraries(\n          \${LIB_TARGET_NAME}\n          fbjni\n          jsi\n          reactnative\n  )`,
          to: `  target_link_libraries(\n          \${LIB_TARGET_NAME}\n          fbjni\n          jsi\n          c++_shared\n          reactnative\n  )`,
        },
        {
          from: `          glog\n          jsi\n          react_codegen_rncore`,
          to: `          glog\n          jsi\n          c++_shared\n          react_codegen_rncore`,
        },
      ],
    },
    {
      relPath: "node_modules/expo-modules-core/android/CMakeLists.txt",
      replacements: [
        {
          from: `  \${LOG_LIB}\n  fbjni::fbjni\n  ReactAndroid::jsi\n  android`,
          to: `  \${LOG_LIB}\n  fbjni::fbjni\n  ReactAndroid::jsi\n  c++_shared\n  android`,
        },
        {
          from: `target_link_libraries(\n  \${PACKAGE_NAME}\n  ReactAndroid::reactnative\n)`,
          to: `target_link_libraries(\n  \${PACKAGE_NAME}\n  ReactAndroid::reactnative\n  c++_shared\n)`,
        },
      ],
    },
    {
      relPath:
        "node_modules/@react-native/codegen/lib/generators/modules/GenerateModuleJniH.js",
      replacements: [
        {
          from: `target_link_libraries(\n  react_codegen_\${targetName}\n  fbjni\n  jsi\n  # We need to link different libraries based on whether we are building rncore or not, that's necessary`,
          to: `target_link_libraries(\n  react_codegen_\${targetName}\n  fbjni\n  jsi\n  c++_shared\n  # We need to link different libraries based on whether we are building rncore or not, that's necessary`,
        },
      ],
    },
  ];

  const optionalUpdates = [
    "node_modules/@react-native-async-storage/async-storage/android/build/generated/source/codegen/jni/CMakeLists.txt",
    "node_modules/react-native-gesture-handler/android/build/generated/source/codegen/jni/CMakeLists.txt",
    "node_modules/react-native-reanimated/android/build/generated/source/codegen/jni/CMakeLists.txt",
    "node_modules/react-native-worklets/android/build/generated/source/codegen/jni/CMakeLists.txt",
  ].map((relPath) => ({
    relPath,
    replacements: [
      {
        from: `target_link_libraries(\n  react_codegen_`,
        to: `target_link_libraries(\n  react_codegen_`,
      },
      {
        from: `  fbjni\n  jsi\n  # We need to link different libraries based on whether we are building rncore or not, that's necessary`,
        to: `  fbjni\n  jsi\n  c++_shared\n  # We need to link different libraries based on whether we are building rncore or not, that's necessary`,
      },
    ],
  }));

  let changed = 0;

  for (const update of updates) {
    if (patchFile(update.relPath, update.replacements)) {
      changed += 1;
    }
  }

  for (const update of optionalUpdates) {
    if (patchFile(update.relPath, update.replacements, { optional: true })) {
      changed += 1;
    }
  }

  console.log(
    `Prepared local Android build patches (${changed} file${changed === 1 ? "" : "s"} updated).`,
  );
}

prepare();

if (!prepareOnly) {
  // On Windows, cmd.exe (used under shell:true) won't resolve a bare
  // "gradlew.bat" against cwd — it needs the explicit ".\" prefix.
  run(
    process.platform === "win32" ? ".\\gradlew.bat" : "./gradlew",
    ["assembleRelease"],
    path.join(root, "android"),
  );
}
