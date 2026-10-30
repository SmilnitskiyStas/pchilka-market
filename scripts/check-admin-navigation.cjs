const fs = require('fs');
const path = require('path');
const assert = require('node:assert/strict');
const Module = require('module');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
const resolve = Module._resolveFilename;
Module._resolveFilename = function(request, parent, ...args) { return resolve.call(this, request.startsWith('@/') ? path.join(root, request.slice(2)) : request, parent, ...args); };
for (const extension of ['.ts','.tsx']) require.extensions[extension] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename,'utf8'), {
  compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}
}).outputText,filename);

const nav = require('../lib/admin-navigation.ts');
const access = require('../lib/admin-permissions.ts');
const original = JSON.stringify(nav.adminNavigation);
const all = nav.flattenAdminNavigation(nav.getAdminNavigation('admin',[],7));
assert.equal(new Set(all.map(item=>item.href)).size,all.length,'Every destination occurs once');
assert.equal(all.find(item=>item.href==='/admin/messages').badge,7);
assert.ok(!nav.flattenAdminNavigation(nav.getAdminNavigation('admin',[],0)).some(item=>item.badge));
assert.deepEqual(nav.getAdminNavigation('editor',[]),[]);
for (const resource of access.ADMIN_RESOURCES) {
  const permissions=[`${resource}:read`];
  const visible=nav.getAdminNavigation('editor',permissions);
  for (const item of nav.flattenAdminNavigation(visible)) assert.ok(access.hasAdminPermission('editor',permissions,access.resourceForAdminPath(item.href)),item.href);
  function checkGroups(items) { for(const item of items) { if(!item.href) { assert.ok(item.children?.length);checkGroups(item.children); } } }
  checkGroups(visible);
}
const content = nav.getAdminNavigation('editor',['content:write']);
assert.deepEqual(content.map(item=>item.id || item.href),['/admin','site']);
assert.ok(!nav.flattenAdminNavigation(content).some(item=>item.href==='/admin/media'));
const expected = [
 '/admin','/admin/engineering','/admin/pages','/admin/content','/admin/menu','/admin/home-slides','/admin/media','/admin/own-brand','/admin/cooperation/offer-product','/admin/seo',
 '/admin/promotions','/admin/marketing/loyalty-rule-analytics','/admin/marketing/megogo-codes','/admin/network','/admin/messages','/admin/training','/admin/career-telegram',
 '/admin/inventory','/admin/inventory/products','/admin/inventory/products/create','/admin/inventory/products/import','/admin/inventory/products/product-info',
 '/admin/inventory/batches','/admin/inventory/batches/expiring','/admin/inventory/batches/overdue','/admin/inventory/batches/action-required','/admin/inventory/batches/written-off',
 '/admin/inventory/tasks','/admin/inventory/employees','/admin/inventory/actions','/admin/inventory/notifications','/admin/inventory/analytics','/admin/inventory/settings/schema','/admin/inventory/settings/telegram',
 '/admin/utility-meters','/admin/utility-meters/missing','/admin/utility-meters/missing-rates','/admin/utility-meters/rates','/admin/utility-meters/document',
 '/admin/users','/admin/integrations','/admin/fun-telegram'
];
assert.deepEqual(all.map(item=>item.href).sort(),expected.sort(),'Preserve all existing modules and canonical destinations');
assert.ok(!all.some(item=>['/admin/blog','/admin/banners','/admin/product-info'].includes(item.href)));
const sections = require('../components/admin/admin-sections.ts').adminSections;
assert.deepEqual(sections.map(item=>item.href).sort(),all.map(item=>item.href).sort(),'Dashboard directory and sidebar use the same structure');
assert.equal(JSON.stringify(nav.adminNavigation),original,'Role filtering and badges never modify the shared definition');
console.log(`PASS: ${all.length} unique canonical destinations; all modules retained; shared dashboard/sidebar; role isolation; empty groups hidden; message badges; immutable navigation.`);

const hrPermissions = ['career_telegram:read', 'career_telegram:write'];
assert.deepEqual(nav.flattenAdminNavigation(nav.getAdminNavigation('editor', hrPermissions)).map(item=>item.href), ['/admin','/admin/career-telegram']);
for (const url of ['/admin/career-telegram', '/api/admin/career-telegram']) assert.equal(access.resourceForAdminPath(url),'career_telegram');
assert.equal(access.hasAdminPermission('editor', hrPermissions, 'telegram'),false);
assert.equal(access.hasAdminPermission('editor', ['telegram:write'], 'career_telegram','write'),true,'Existing shared permissions retain access');
assert.equal(access.hasAdminPermission('editor', ['career_telegram:read'], 'career_telegram','write'),false);
const groups = require('../lib/admin-permission-groups.ts').getAdminPermissionGroups();
const modules = groups.flatMap(group=>group.modules);
assert.deepEqual(modules.map(item=>item.resource).sort(),access.ADMIN_PERMISSION_OPTIONS.filter(item=>!['users','system'].includes(item.resource)).map(item=>item.resource).sort());
assert.equal(groups.find(group=>group.modules.some(item=>item.resource==='career_telegram')).label,'Працівники та найм');
assert.deepEqual(modules.find(item=>item.resource==='career_telegram').pages.map(item=>item.href),['/admin/career-telegram']);
assert.deepEqual(modules.find(item=>item.resource==='telegram').pages.map(item=>item.href),['/admin/career-telegram','/admin/fun-telegram']);
console.log('PASS: separate HR access, legacy Telegram compatibility and permission groups match current navigation.');
