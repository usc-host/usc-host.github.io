/* Catalog images are absolute CDN links or files shipped in public/. */
export const asset = (url: string) => (/^https?:/.test(url) ? url : `${import.meta.env.BASE_URL}${url.replace(/^\//, '')}`);
