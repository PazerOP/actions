"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.getCacheScope = getCacheScope;
exports.getBuildCacheKey = getBuildCacheKey;
const core = __importStar(require("@actions/core"));
function getCacheScope() {
    const scope = core.getInput('cache-scope') || 'repo';
    return (scope === 'branch' || scope === 'commit') ? scope : 'repo';
}
function getBuildCacheKey(cacheKey, scope) {
    const os = process.platform; // linux, darwin, win32
    const base = cacheKey ? `buildcache-${os}-${cacheKey}` : `buildcache-${os}`;
    if (scope === 'repo') {
        return base;
    }
    const ref = process.env.GITHUB_REF || '';
    let branch = 'unknown';
    if (ref.startsWith('refs/heads/')) {
        branch = ref.replace('refs/heads/', '');
    }
    else if (ref.startsWith('refs/pull/')) {
        const prNum = ref.match(/refs\/pull\/(\d+)/)?.[1];
        branch = prNum ? `pr-${prNum}` : 'unknown';
    }
    if (scope === 'branch') {
        return `${base}-${branch}`;
    }
    const sha = process.env.GITHUB_SHA || 'unknown';
    return `${base}-${branch}-${sha}`;
}
