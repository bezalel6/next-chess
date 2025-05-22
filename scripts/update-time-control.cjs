#!/usr/bin/env node
/**
 * Script to update the default time control values across all files
 * This ensures the single source of truth is maintained
 *
 * Usage:
 * node scripts/update-time-control.js --initialTime 900000 --increment 0
 *
 * This would update the default time control to the specified values
 */

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

// Parse command line arguments
const args = process.argv.slice(2);
let initialTime = null;
let increment = null;

for (let i = 0; i < args.length; i++) {
  if (args[i] === "--initialTime" && i + 1 < args.length) {
    initialTime = parseInt(args[i + 1], 10);
    i++;
  } else if (args[i] === "--increment" && i + 1 < args.length) {
    increment = parseInt(args[i + 1], 10);
    i++;
  }
}

if (initialTime === null || increment === null) {
  console.error(
    "Usage: node scripts/update-time-control.js --initialTime <ms> --increment <ms>",
  );
  process.exit(1);
}

// Format initialTime for display
function formatTimeForDisplay(ms) {
  const minutes = ms / 60000;
  return minutes >= 1 ? `${minutes} minutes` : `${ms} milliseconds`;
}

// Confirm with user
console.log(
  `Updating default time control to: ${formatTimeForDisplay(initialTime)} with ${increment > 0 ? formatTimeForDisplay(increment) + " increment" : "no increment"}`,
);
console.log("This will update all source files with the new values.");
console.log("Press Ctrl+C to cancel or wait 5 seconds to continue...");

// Wait 5 seconds before proceeding
setTimeout(() => {
  updateFiles();
}, 5000);

function updateFiles() {
  // List of files to update
  const files = [
    {
      path: "src/constants/timeControl.ts",
      update: (content) => {
        return content
          .replace(
            /initialTime: (\d+) \* 60 \* 1000/g,
            `initialTime: ${initialTime / 60000} * 60 * 1000`,
          )
          .replace(/increment: \d+/g, `increment: ${increment}`);
      },
    },
    {
      path: "supabase/functions/_shared/constants.ts",
      update: (content) => {
        return content
          .replace(
            /initialTime: (\d+) \* 60 \* 1000/g,
            `initialTime: ${initialTime / 60000} * 60 * 1000`,
          )
          .replace(/increment: \d+/g, `increment: ${increment}`);
      },
    },
    {
      path: "supabase/migrations/20250514001000_time_control_functions.sql",
      update: (content) => {
        return content
          .replace(
            /time_control = '{"initial_time": \d+, "increment": \d+}'/g,
            `time_control = '{"initial_time": ${initialTime}, "increment": ${increment}}'`,
          )
          .replace(
            /white_time_remaining = \d+/g,
            `white_time_remaining = ${initialTime}`,
          )
          .replace(
            /black_time_remaining = \d+/g,
            `black_time_remaining = ${initialTime}`,
          );
      },
    },
  ];

  // Update each file
  files.forEach((file) => {
    const filePath = path.resolve(process.cwd(), file.path);
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, "utf8");
      const updated = file.update(content);
      fs.writeFileSync(filePath, updated);
      console.log(`Updated: ${file.path}`);
    } else {
      console.error(`File not found: ${file.path}`);
    }
  });

  console.log("All files updated successfully!");
  console.log("Remember to commit these changes and redeploy if necessary.");
}
