"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.prisma = void 0;

const client_1 = require("@prisma/client");

// Singleton pattern for Prisma Client
const globalForPrisma = global;

exports.prisma = globalForPrisma.prisma || new client_1.PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
});

if (process.env.NODE_ENV !== 'production') {
    globalForPrisma.prisma = exports.prisma;
}

// Re-export everything from @prisma/client
const client_2 = require("@prisma/client");
Object.keys(client_2).forEach(function (k) {
    if (k !== 'default' && !exports.hasOwnProperty(k)) {
        Object.defineProperty(exports, k, {
            enumerable: true,
            get: function () { return client_2[k]; }
        });
    }
});
