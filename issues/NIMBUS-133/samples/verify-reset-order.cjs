const assert = require("node:assert/strict");
const {
  RoutesSorter,
} = require("../../../apps/backend/node_modules/@medusajs/framework/dist/http/routes-sorter.js");

const sorted = new RoutesSorter([
  {
    matcher: "/auth/:actor_type/:auth_provider/update",
    methods: ["POST"],
    label: "core-consume",
  },
  {
    matcher: "/auth/customer/emailpass/update",
    methods: ["POST"],
    label: "project-validation",
  },
]).sort().map((route) => route.label);

assert.deepEqual(sorted, ["project-validation", "core-consume"]);
console.log(JSON.stringify(sorted));
