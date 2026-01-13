import { 
    parseProjectIdentifier, 
    fetchProjectMetadata, 
    getAllProjectRevisions, 
    getAssets,
    getProjectHtml,
    processAssets 
} from './websim-api.js';

import { generateZip } from './generator.js';

// Load API source code for context display
const loadApiContext = async () => {
    try {
        const files = [
            './src/api/core.js',
            './src/api/project.js',
            './src/api/assets.js',
            './src/api/html.js'
        ];
        
        const contents = await Promise.all(files.map(async f => {
            const txt = await fetch(f).then(r => r.text());
            return `// --- ${f} ---\n${txt}\n`;
        }));
        
        document.getElementById('api-context').value = contents.join('\n');
    } catch(e) {
        console.warn("Failed to load API context", e);
    }
};

loadApiContext();

// DOM Elements
const inputEl = document.getElementById('project-input');
const btnFetch = document.getElementById('btn-fetch');
const btnDownload = document.getElementById('btn-download');
const btnReset = document.getElementById('btn-reset');
const btnCopyApi = document.getElementById('btn-copy-api');
const stepInput = document.getElementById('step-input');
const stepDownload = document.getElementById('step-download');
const versionSelect = document.getElementById('version-select');
const loading = document.getElementById('loading');
const loadingText = document.getElementById('loading-text');
const errorEl = document.getElementById('fetch-error');
const projectTitle = document.getElementById('project-title');
const projectAuthor = document.getElementById('project-author');
const projectThumb = document.getElementById('project-thumb');

let currentProjectMeta = null;

const toggleLoading = (show, text = 'Processing...') => {
    loadingText.textContent = text;
    loading.classList.toggle('hidden', !show);
};

const showError = (msg) => {
    errorEl.textContent = msg;
    errorEl.classList.remove('hidden');
};

const saveAs = (blob, filename) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
};

// --- Handlers ---

btnFetch.addEventListener('click', async () => {
    const rawInput = inputEl.value.trim();
    if (!rawInput) return showError("Please enter a URL or ID.");

    errorEl.classList.add('hidden');
    toggleLoading(true, 'Fetching metadata...');

    try {
        const identifier = parseProjectIdentifier(rawInput);
        const meta = await fetchProjectMetadata(identifier);
        
        if (!meta || !meta.project) throw new Error("Project not found.");

        currentProjectMeta = meta;

        // Populate UI
        projectTitle.textContent = meta.project.title;
        projectAuthor.textContent = `by @${meta.project.owner?.username || 'unknown'}`;
        if (meta.project.thumbnail_url) {
            projectThumb.src = meta.project.thumbnail_url;
            projectThumb.classList.remove('hidden');
        } else {
            projectThumb.classList.add('hidden');
        }

        // Fetch Versions
        toggleLoading(true, 'Fetching version history...');
        const revisions = await getAllProjectRevisions(meta.project.id);

        // Populate Select
        versionSelect.innerHTML = '';
        
        const currentOpt = document.createElement('option');
        currentOpt.value = meta.project.current_version;
        currentOpt.textContent = `Latest (v${meta.project.current_version})`;
        versionSelect.appendChild(currentOpt);

        revisions.forEach(rev => {
            if (rev.id === meta.project.current_version) return;
            const opt = document.createElement('option');
            opt.value = rev.id;
            const date = new Date(rev.created_at).toLocaleDateString();
            opt.textContent = `v${rev.id} - ${date}`;
            versionSelect.appendChild(opt);
        });

        stepInput.classList.add('hidden');
        stepDownload.classList.remove('hidden');

    } catch (err) {
        showError(err.message || "Failed to fetch project.");
    } finally {
        toggleLoading(false);
    }
});

btnDownload.addEventListener('click', async () => {
    if (!currentProjectMeta) return;
    const version = versionSelect.value;
    
    toggleLoading(true, 'Downloading assets...');

    try {
        // 1. Fetch Assets List & HTML content
        const [assetList, htmlContent] = await Promise.all([
            getAssets(currentProjectMeta.project.id, version),
            getProjectHtml(currentProjectMeta.project.id, version)
        ]);

        console.log(`Found ${assetList.length} assets.`);

        // 2. Process/Download Content
        toggleLoading(true, `Downloading ${assetList.length} files...`);
        const files = await processAssets(assetList, currentProjectMeta.project.id, version);

        // 3. Inject HTML
        if (htmlContent) {
            files['index.html'] = new TextEncoder().encode(htmlContent);
        } else if (!files['index.html']) {
            // Fallback for missing index
            files['index.html'] = new TextEncoder().encode(`<html><body><h1>${currentProjectMeta.project.title}</h1><script src="script.js"></script></body></html>`);
        }

        // 4. Generate Zip
        const zipBlob = await generateZip(files);
        const filename = `${currentProjectMeta.project.slug || 'websim-project'}-v${version}.zip`;
        
        saveAs(zipBlob, filename);

    } catch (err) {
        alert("Download failed: " + err.message);
        console.error(err);
    } finally {
        toggleLoading(false);
    }
});

btnReset.addEventListener('click', () => {
    stepDownload.classList.add('hidden');
    stepInput.classList.remove('hidden');
    inputEl.value = '';
    currentProjectMeta = null;
});

btnCopyApi.addEventListener('click', () => {
    const el = document.getElementById('api-context');
    el.select();
    document.execCommand('copy');
    const originalText = btnCopyApi.textContent;
    btnCopyApi.textContent = 'Copied!';
    setTimeout(() => btnCopyApi.textContent = originalText, 2000);
});