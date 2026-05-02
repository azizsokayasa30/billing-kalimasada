const fs = require('fs');

const FILE_PATH = 'views/admin/billing/customers.ejs';
let content = fs.readFileSync(FILE_PATH, 'utf8');

content = content.replace(
    '<select name="month" class="form-select form-select-sm shadow-sm border-primary" style="width: 150px;">',
    '<select name="month" class="form-select form-select-sm shadow-sm border-primary" style="width: 150px;" onchange="document.getElementById(\\\'timeFilterForm\\\').submit()">'
);

content = content.replace(
    '<select name="year" class="form-select form-select-sm shadow-sm border-primary" style="width: 100px;">',
    '<select name="year" class="form-select form-select-sm shadow-sm border-primary" style="width: 100px;" onchange="document.getElementById(\\\'timeFilterForm\\\').submit()">'
);

// We can hide the "Terapkan" button since it auto-submits now, to avoid confusion.
content = content.replace(
    '<button type="submit" class="btn btn-primary btn-sm mb-0">Terapkan Rentang Waktu</button>',
    '<button type="submit" class="btn btn-primary btn-sm mb-0 d-none">Terapkan Rentang Waktu</button>'
);

fs.writeFileSync(FILE_PATH, content, 'utf8');
console.log('Added onchange auto-submit to month/year select');
