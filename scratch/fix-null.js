const fs = require('fs');

const FILE_PATH = 'config/billing.js';
let content = fs.readFileSync(FILE_PATH, 'utf8');

const oldResolve = `                    resolve({
                        total: row ? row.total : 0,
                        aktif: row ? row.aktif : 0,
                        nonaktif: row ? row.nonaktif : 0,
                        lunas: row ? row.lunas : 0,
                        belum_lunas: row ? row.belum_lunas : 0,
                        baru: row ? row.baru : 0
                    });`;

const newResolve = `                    resolve({
                        total: (row && row.total) ? row.total : 0,
                        aktif: (row && row.aktif) ? row.aktif : 0,
                        nonaktif: (row && row.nonaktif) ? row.nonaktif : 0,
                        lunas: (row && row.lunas) ? row.lunas : 0,
                        belum_lunas: (row && row.belum_lunas) ? row.belum_lunas : 0,
                        baru: (row && row.baru) ? row.baru : 0
                    });`;

content = content.replace(oldResolve, newResolve);
fs.writeFileSync(FILE_PATH, content, 'utf8');
console.log('Fixed null evaluation in billing.js');
