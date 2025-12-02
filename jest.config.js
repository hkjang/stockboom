module.exports = {
    moduleFileExtensions: ['js', 'json', 'ts'],
    rootDir: '.',
    testRegex: '.*\\.spec\\.ts$',
    transform: {
        '^.+\\.(t|j)s$': 'ts-jest',
    },
    collectCoverageFrom: [
        '**/*.(t|j)s',
        '!**/*.spec.(t|j)s',
        '!**/node_modules/**',
        '!**/dist/**',
    ],
    coverageDirectory: './coverage',
    testEnvironment: 'node',
    roots: ['<rootDir>/apps/', '<rootDir>/packages/'],
    moduleNameMapper: {
        '^@stockboom/database$': '<rootDir>/packages/database/src',
        '^@stockboom/types$': '<rootDir>/packages/types/src',
    },
};
