import { Buffer } from 'node:buffer';
import terminal from '../resources/terminal.svg.txt';
import getUserInfoQuery from '../resources/getUserInfo.gql.txt';
import sourceCodePro from '../resources/SourceCodePro.woff.base64.txt';

export const config = {
    runtime: 'edge',
};

export default async (req) => {
    // const url = new URL(req.url);

    // const username = url.searchParams.get('username') ?? 'kd3n1z';
    // const ignoredLangs = (url.searchParams.get('ignore') ?? '').split(',');

    const username = 'kd3n1z';
    const ignoredLangs = ['html', 'css', 'scss', 'makefile', 'shell', 'dockerfile'];

    const response = await (
        await fetch('https://api.github.com/graphql', {
            method: 'POST',
            headers: {
                Authorization: 'Bearer ' + process.env.GITHUB_TOKEN,
            },
            body: JSON.stringify({
                query: getUserInfoQuery,
                variables: {
                    username,
                    avatarSize: 160,
                },
            }),
        })
    ).json();

    const langsMap = new Map();

    let totalCount = 0;

    for (const repo of response.data.user.repositories.nodes.map((e) => e.languages.edges)) {
        for (const langNode of repo) {
            const langName = langNode.node.name;
            if (ignoredLangs.includes(langName.toLowerCase())) {
                continue;
            }

            if (!langsMap.has(langName)) {
                langsMap.set(langName, {
                    color: langNode.node.color,
                    count: 0,
                });
            }

            langsMap.get(langName).count += langNode.size;
            totalCount += langNode.size;
        }
    }

    let langsSvg = '';
    let y = 142;

    const sortedLangs = Array.from(langsMap.entries()).sort((a, b) => b[1].count - a[1].count);

    const digits = 2;
    const pow = Math.pow(10, digits);

    for (let i = 0; i < sortedLangs.length; i++) {
        if (i >= 10) {
            langsSvg += `
        <text x="112" y="${y}" dominant-baseline="hanging" fill="white">
            and ${sortedLangs.length - i} more...
        </text>`;
            break;
        }

        const [lang, data] = sortedLangs[i];

        let r = parseInt(data.color.slice(1, 3), 16) / 255;
        let g = parseInt(data.color.slice(3, 5), 16) / 255;
        let b = parseInt(data.color.slice(5, 7), 16) / 255;

        let min = Math.min(r, g, b);
        let max = Math.max(r, g, b);
        let delta = max - min;

        let l = (max + min) / 2;

        let s = delta === 0 ? 0 : delta / (1 - Math.abs(2 * l - 1));

        let h = 0;
        if (delta !== 0) {
            if (max === r) {
                h = ((g - b) / delta + (g < b ? 6 : 0)) * 60;
            } else if (max === g) {
                h = ((b - r) / delta + 2) * 60;
            } else {
                h = ((r - g) / delta + 4) * 60;
            }
        }

        const color = `hsl(${h}, ${s * 200}%, 50%)`;

        langsSvg += `
            <text x="112" y="${y}" dominant-baseline="hanging" fill="${color}">
                - ${lang}: ${Math.round((data.count / totalCount) * 100 * pow) / pow}%
            </text>`;
        y += 18;
    }

    return new Response(
        terminal
            .replaceAll('<!-- %USERNAME% -->', username)
            .replaceAll('<!-- %NAME% -->', response.data.user.name)
            .replaceAll('<!-- %LANGS% -->', langsSvg)
            .replaceAll('%AVATAR_URL%', await fetchDataUrl(response.data.user.avatarUrl))
            .replaceAll('%FONT_URL%', `data:font/woff;base64,${sourceCodePro}`),
        {
            headers: {
                'Content-Type': 'image/svg+xml',
                'Vercel-CDN-Cache-Control': 'max-age=1800',
                'Cache-Control': 'public, max-age=300',
            },
        }
    );
};

async function fetchDataUrl(url) {
    const response = await fetch(url);
    const buffer = Buffer.from(await response.arrayBuffer());
    const base64 = buffer.toString('base64');
    const mimeType = response.headers.get('content-type');
    return `data:${mimeType};base64,${base64}`;
}
