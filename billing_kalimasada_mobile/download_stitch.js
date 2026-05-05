const https = require('https');
const fs = require('fs');
const path = require('path');

const targetDir = path.join(__dirname, 'stitch_designs');
if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
}

const filesToDownload = [
    { name: "01_tag_location", img: "https://lh3.googleusercontent.com/aida/ADBb0uhJjCdaxmdlo6nnF0tm2ZK0W0ddGzyjcyN-EqkE-5fW1f5y4Vl-5S29hO6gqLPTg1byTaDf-xICeoxus4TqMv-ZLY3RYXSS_0XBwX5bRrIypUS_9C7CPncmsT-hjajW4XEbrBTks5o8Y7JN4xrKgt6OuA5IeCxU-J2UBjYtwMmiaHGDKjS7nJha2DdK1NZGEH6zPdVe16FQZeSdiBUZ_l1X5SetLjq3DA4MJPbCnmIbIdIx6arHnq4lnSY", html: "https://contribution.usercontent.google.com/download?c=CgthaWRhX2NvZGVmeBJ7Eh1hcHBfY29tcGFuaW9uX2dlbmVyYXRlZF9maWxlcxpaCiVodG1sX2VhMzhmYTViNGE2MDQ0MGZhMTZiNjE0ODE5M2NmZDBjEgsSBxDr8dOb3hQYAZIBIwoKcHJvamVjdF9pZBIVQhM1MTc2MDM3MjQyNDM1MjMyNDA4&filename=&opi=89354086" },
    { name: "02_technician_profile", img: "https://lh3.googleusercontent.com/aida/ADBb0uiLfhhsXQZUuyJSeU2dGqwEOwyoGUWA_AM0YsUKwgSiCOCMmDzVIKV9hYSWhZFITJlGA1EPTnENYfAJN7GIZXF1bPJA7pH98dBgzUn42728CzRFs9ReFlZjWrCzzea795Jt2L9yggFDia6nfjyLMvpIrnj0ZmDehiM-Ynu7e7re5Nmrk2tUTIGH4U5YKtoi8ovNot14fsxGn4pb9b0K4fngXEMOh8Y0mEHu4wHIsceZy96gxW86kIPQDA", html: "https://contribution.usercontent.google.com/download?c=CgthaWRhX2NvZGVmeBJ7Eh1hcHBfY29tcGFuaW9uX2dlbmVyYXRlZF9maWxlcxpaCiVodG1sX2ViNTI1MGY5N2UwYTQ4ZDJhMDE1M2ZkMjUzYWM1NDljEgsSBxDr8dOb3hQYAZIBIwoKcHJvamVjdF9pZBIVQhM1MTc2MDM3MjQyNDM1MjMyNDA4&filename=&opi=89354086" },
    { name: "03_pemetaan_jaringan", img: "https://lh3.googleusercontent.com/aida/ADBb0uj5zk3zHbZDiRDmpiIjCkPvEgb8EptiydO9RdaDbsfdgH7tjMNn_3yC67c5gZf6zSK-IyWeXx5s0RJEWCJb5WIkDb2qze4HzQPA4f07yYmBhbyjcxvIfCyd2KgQsl5_cgZ2YgT6RHBvCdSOnKPeMhuJeDz0sdlKV_SqRg6dPsyHiArtUd2kk4IDHKFmaaMdoAQOqW492f7zk5HRHWpgDg_UIAh12Z-CWyBuVX0FXNpFR2splKg538W-oQ", html: "https://contribution.usercontent.google.com/download?c=CgthaWRhX2NvZGVmeBJ7Eh1hcHBfY29tcGFuaW9uX2dlbmVyYXRlZF9maWxlcxpaCiVodG1sX2VkY2Y1YTRiNzBkZjQyYjVhYzRjMzkyMmY2MTM1MGI2EgsSBxDr8dOb3hQYAZIBIwoKcHJvamVjdF9pZBIVQhM1MTc2MDM3MjQyNDM1MjMyNDA4&filename=&opi=89354086" },
    { name: "04_new_task_form", img: "https://lh3.googleusercontent.com/aida/ADBb0ujfd4L-XCsuymWEiUi4AmtY2uB2zxOh-KIChblN9PsEmiICmiRY1DMtwOPFA1-IzfRoqqEgVzll4YtEOmoYeU7Rr8tBem3xcJcJgKfhKdxapVtkA2ZVjEJMhbwLEruGJAcOPiVRd_xaaFMSN_boMcOBpHKsEPZ1AiII-ruueLj1K6PmGujLqphoo-IwavSg2B8B8lurJQNi9GCYKTgxJInV5QdRvgeh90wJgb-Xfvl8TiRrrJnxPFDhtw", html: "https://contribution.usercontent.google.com/download?c=CgthaWRhX2NvZGVmeBJ7Eh1hcHBfY29tcGFuaW9uX2dlbmVyYXRlZF9maWxlcxpaCiVodG1sXzE0NTA1Y2Y2NWRlZjRjYjFiNzcyNWM2OTRmMjJjODYyEgsSBxDr8dOb3hQYAZIBIwoKcHJvamVjdF9pZBIVQhM1MTc2MDM3MjQyNDM1MjMyNDA4&filename=&opi=89354086" },
    { name: "05_daftar_tugas", img: "https://lh3.googleusercontent.com/aida/ADBb0uiuCTjdFwqFDxBmdYs3CtAoSeBxniwse77b5lbTykYUaxPxRJPITFoyLCCH7oj7GGTvYFwdZBS3taMZYEWeN_maHoLqOb2C--QY_Go-FCeADou1LovjR2EuMlEGhxdMDKjo2rLpSHGL7N4MCO3QCv5dwZKaOJCB0I4JlNUWzlQUF3fE8XQqoOja6wfXiFnNy6r38XOHBKUBiU7xME4YTvzrpILo-lLWCe7vc3k4ZdDegu-GhVdfbZZsWQ", html: "https://contribution.usercontent.google.com/download?c=CgthaWRhX2NvZGVmeBJ7Eh1hcHBfY29tcGFuaW9uX2dlbmVyYXRlZF9maWxlcxpaCiVodG1sXzMwNWZkY2I2ZjhhYzQxNDY4MzgyMWQ2NWQ0M2U4OGY2EgsSBxDr8dOb3hQYAZIBIwoKcHJvamVjdF9pZBIVQhM1MTc2MDM3MjQyNDM1MjMyNDA4&filename=&opi=89354086" },
    { name: "06_customer_detail", img: "https://lh3.googleusercontent.com/aida/ADBb0uj3HFplB7w3lfc7hqcfeS6hCgJRE9GoVlIV2bQaah4iZvL2Otp7OuJSPnkI3q3I4CNhhqDMgRTt06lrj36zI9TH3VAEEwsY9n26FUAkRKlTJAEw2vAyN9c8fYL7TxpI8JZCp7sQS1NWjQrSotqGBiE-5mDKwDf6XArH50NuOzqHw1Tp1_f6ytOi70SdkkWK9tqtC-mQVQe0kNKDyQpyWOFTz6i6ldbx4xW26aYSLWftAbnye054dP5Ifws", html: "https://contribution.usercontent.google.com/download?c=CgthaWRhX2NvZGVmeBJ7Eh1hcHBfY29tcGFuaW9uX2dlbmVyYXRlZF9maWxlcxpaCiVodG1sX2FhZGEwOTAwYTUxODRjZDc4ZjcyN2U3OWUxZWNkZDVlEgsSBxDr8dOb3hQYAZIBIwoKcHJvamVjdF9pZBIVQhM1MTc2MDM3MjQyNDM1MjMyNDA4&filename=&opi=89354086" },
    { name: "07_daftar_tugas_add", img: "https://lh3.googleusercontent.com/aida/ADBb0ujg-_Ut3yWt-pqoGT-fxQ2aIfDp1WXjzGGwnPmpmCEw6laHpOqVoZ7XoD0gT0fSrnw4wctoLf9js-UUeTQUbalZm_9-JKtBQwE9pHA0m7srJ-oFx1JqlSHFL_dJRFnkWBPvEDJQvt_uuet-lIZNKZV1QWqmfuI3Gz4DZQZtnsFkcj2nN5bbk0Mrh0PfzGHGYn2q1nFveZqBn0ye3toTFTgFm4712Qj0B-hDN7n2_7wkf_I38ZvFy1EY9w", html: "https://contribution.usercontent.google.com/download?c=CgthaWRhX2NvZGVmeBJ7Eh1hcHBfY29tcGFuaW9uX2dlbmVyYXRlZF9maWxlcxpaCiVodG1sXzlhYTI4OTVmYTFkMDRjYWVhNjU3MGY2M2JiM2YxZWY2EgsSBxDr8dOb3hQYAZIBIwoKcHJvamVjdF9pZBIVQhM1MTc2MDM3MjQyNDM1MjMyNDA4&filename=&opi=89354086" },
    { name: "08_navigation_menu", img: "https://lh3.googleusercontent.com/aida/ADBb0uiq96DGxNJuaim7rqrBoj7Hsu8iZPIKf5Pqi_GNw19ax725IMCH6VVRx8P_zg7FYyV8iedidvoUDA5IeXWu2XQQHGbGcHdSmzg4pS6osJaG37liK0i5OI6PWg9EWpvMbKgtlFKW9qSJQr2pPGxGifut1Az-iziwmE152qluSnFLoPAsjp3Oae8tz43rJ3cJB_5SkwGm5nxvlpSHfEz906UpbhppmRLFsga3Tcr4Sp1U0x0pM8s2RtrYQZg", html: "https://contribution.usercontent.google.com/download?c=CgthaWRhX2NvZGVmeBJ7Eh1hcHBfY29tcGFuaW9uX2dlbmVyYXRlZF9maWxlcxpaCiVodG1sXzQzMDNmYWUzZWRhMDRjMWM4Y2M1M2YzNjMxZDFhNzZlEgsSBxDr8dOb3hQYAZIBIwoKcHJvamVjdF9pZBIVQhM1MTc2MDM3MjQyNDM1MjMyNDA4&filename=&opi=89354086" },
    { name: "09_customer_list_compact", img: "https://lh3.googleusercontent.com/aida/ADBb0ui6MXCjT364jJR1jcZaXH8HrszESi7wq56vVFM1POf9HaimCpBQ2Fekmi9gz19v4j4mqauly4olke5dT2niC9jqoiSp3aj79bUVEIlJ7lqlWjWE1-6NAZWmo9fRAM2D3WkVw8ExPGvjAEILUr5nGVcgW4TQ76w4hsyGwWaOirk5eeWOvj6khQURCcIqpiRJ6LfRLaEbbjyJ7CXXt0TZP2lwAwQVz0E0zyYcuVhb15FZMdPg4rKb-4BAKVY", html: "https://contribution.usercontent.google.com/download?c=CgthaWRhX2NvZGVmeBJ7Eh1hcHBfY29tcGFuaW9uX2dlbmVyYXRlZF9maWxlcxpaCiVodG1sX2Q2NmVjY2M1OWU4ZjRiNzA5NDNhMzFiZjFhMDYxOTRjEgsSBxDr8dOb3hQYAZIBIwoKcHJvamVjdF9pZBIVQhM1MTc2MDM3MjQyNDM1MjMyNDA4&filename=&opi=89354086" },
    { name: "10_execution_notes", img: "https://lh3.googleusercontent.com/aida/ADBb0ug2nROm7CnGXRTWPRmYaDUMWXzYRM5tEmlT0KGKZvBRB7XPyDUOZmAD4Vy_kflOw2MwVL_IE2gfZB3gQoF3O6lRzwRJ3AiGf33A1KPkJYBd1PRfCPIJ9-d6FVx9Pjmp1O-3keTXZioOPPhb9V1TxpIONFUtKW6igh7UEonVFynuZRithZ9Kwy2ScfUregLEHKAc_R-TkDmcr4q1UokyUM9FHUJhU1YbCHTNP5v_LDqje1n2f2rbIRHx4AA", html: "https://contribution.usercontent.google.com/download?c=CgthaWRhX2NvZGVmeBJ7Eh1hcHBfY29tcGFuaW9uX2dlbmVyYXRlZF9maWxlcxpaCiVodG1sXzEyNzg1NTc2OTU0ZDQ4ZmViN2UwZTQ3MjQzNzU4NDNmEgsSBxDr8dOb3hQYAZIBIwoKcHJvamVjdF9pZBIVQhM1MTc2MDM3MjQyNDM1MjMyNDA4&filename=&opi=89354086" },
    { name: "11_detail_odp", img: "https://lh3.googleusercontent.com/aida/ADBb0uj_4o9xRc5UApJpBsqXdVOxVQBxMSyBVxKNWt9hnTUwYL2vEnLLsDDm7gBHJKYMvQ1bq8ME5Kj0W0NauviAIMa3H6ZreJ79IQk99L6t1NXHafQt-c-3OpNHev3J96bcMPq9-cOUVHjYSRpFDYy8gywf6GpG7IPoY9Axz5PrBfwLAj2MvHDIy9K90oBDNZ_xpR_slSXVDbHxw9rUvNnMTxMmKZd_kKcobmJ-pyJvlovl0XeG2OYv3zu7SYA", html: "https://contribution.usercontent.google.com/download?c=CgthaWRhX2NvZGVmeBJ7Eh1hcHBfY29tcGFuaW9uX2dlbmVyYXRlZF9maWxlcxpaCiVodG1sX2FjZDAyOTM1ZGI0NTQwNzNiNWQ0MWIyMThjNjI4MzAwEgsSBxDr8dOb3hQYAZIBIwoKcHJvamVjdF9pZBIVQhM1MTc2MDM3MjQyNDM1MjMyNDA4&filename=&opi=89354086" },
    { name: "12_dashboard", img: "https://lh3.googleusercontent.com/aida/ADBb0uhNkf1sc3OV6HiRmpQarm9MQtA9YYs92URY6vnR2cuHNLg6f9jzr-IAE4IbbwT-IIprGdBa-BJfenPQwM-LqMWMquhkNKVCEpl8h2ZcqJbdaEzdX2DSUhkosEzaTacVi6iBRn7KpdLNdluGiysWgN6i_SDQ-BVwsxdao6ERjJ8sLeSdPB_tTNCk1E3BF51zgSnzz-PYV7mbcXK3SFQ4ZLpA-VTb7qJjUcBWRWQVPKrXc9JXoX3NJtgRA1E", html: "https://contribution.usercontent.google.com/download?c=CgthaWRhX2NvZGVmeBJ7Eh1hcHBfY29tcGFuaW9uX2dlbmVyYXRlZF9maWxlcxpaCiVodG1sX2ZlMGU1MDNkNTc2MjQzNDZhNzQzMGM2Yzk1MTg1OTVhEgsSBxDr8dOb3hQYAZIBIwoKcHJvamVjdF9pZBIVQhM1MTc2MDM3MjQyNDM1MjMyNDA4&filename=&opi=89354086" },
    { name: "13_login", img: "https://lh3.googleusercontent.com/aida/ADBb0uhboTTtPNwN2dv6edSoHZ-44-cGpfx5iYlERjtrug7qM7g5FG7Krn6epCS4MSacAuGXI2Ew1o6NUy0QzCcY2PCro6papdwMvb20uC8_QuIlbTxGjQR3gNbq0IlVQaJGaXzTtOqZ4qGqBMs8RQyNIfWcZ-ucQQW4WpPbMGAksw5JFoxVH2alhR4BEfo8HSPU7f3wzX9-XpYAnjEugfMksiynRyE599LAfD1iB-zNT-_RZGv8xRUJ9yT9IOQ", html: "https://contribution.usercontent.google.com/download?c=CgthaWRhX2NvZGVmeBJ7Eh1hcHBfY29tcGFuaW9uX2dlbmVyYXRlZF9maWxlcxpaCiVodG1sXzdhNTQwNmYzYTFjZjRiNTQ5NTEyZDUzM2NiMDY1ODhkEgsSBxDr8dOb3hQYAZIBIwoKcHJvamVjdF9pZBIVQhM1MTc2MDM3MjQyNDM1MjMyNDA4&filename=&opi=89354086" },
    { name: "14_job_execution", img: "https://lh3.googleusercontent.com/aida/ADBb0ugxzL808iE6Ux8ZaVijjM2aTLyvJlXWks3F2J3o9F-PNmBWjGfJ5I3K-0uQ5W-DBdKouc76aV7TpmevAkjYNedyTYhb4GAO0_Vdso0R-j4lANBfMa7raf0RnnD-juFV8zpn_5zWl5fbA55pk14aU1njzhTwLKZHEioGIyl6RVnaWQd2iFvHX44fSA_4axkeH8zjIPvxMdIyD3Z9LmJcwQTF1bwlO39FKQpWgjFlZbGdQc8y_bICOVyMi8E", html: "https://contribution.usercontent.google.com/download?c=CgthaWRhX2NvZGVmeBJ7Eh1hcHBfY29tcGFuaW9uX2dlbmVyYXRlZF9maWxlcxpaCiVodG1sXzFhOGRjOWU5ZmI5NDQxYmQ4NTAzMjc2YmI0MTkxZjA0EgsSBxDr8dOb3hQYAZIBIwoKcHJvamVjdF9pZBIVQhM1MTc2MDM3MjQyNDM1MjMyNDA4&filename=&opi=89354086" }
];

async function download(url, dest) {
    return new Promise((resolve, reject) => {
        https.get(url, (res) => {
            if (res.statusCode !== 200) {
                // If it's a redirect
                if (res.statusCode === 302 || res.statusCode === 301) {
                    https.get(res.headers.location, (res2) => {
                        const file = fs.createWriteStream(dest);
                        res2.pipe(file);
                        file.on('finish', () => { file.close(); resolve(); });
                    }).on('error', reject);
                    return;
                }
                reject(new Error(`Failed to get '${url}' (${res.statusCode})`));
                return;
            }
            const file = fs.createWriteStream(dest);
            res.pipe(file);
            file.on('finish', () => { file.close(); resolve(); });
        }).on('error', reject);
    });
}

async function main() {
    for (const item of filesToDownload) {
        console.log(`Downloading ${item.name}...`);
        await download(item.img, path.join(targetDir, `${item.name}.png`));
        await download(item.html, path.join(targetDir, `${item.name}.html`));
    }
    console.log("All downloads completed!");
}

main().catch(console.error);
