import JSZip from 'jszip';

export async function generateZip(files) {
    const zip = new JSZip();
    
    console.log(`[Generator] Zipping ${Object.keys(files).length} files...`);

    for (const [path, content] of Object.entries(files)) {
        // Ensure path doesn't start with slash
        const cleanPath = path.replace(/^\/+/, '');
        zip.file(cleanPath, content);
    }

    return await zip.generateAsync({ type: "blob" });
}