const SITE = process.env.NEXT_PUBLIC_SITE_URL || 'https://baixosfronteirajag.vertraweb.app'
export default function sitemap(){const now=new Date();return [{url:`${SITE}/`,lastModified:now,changeFrequency:'daily',priority:1},{url:`${SITE}/agenda`,lastModified:now,changeFrequency:'daily',priority:.9},{url:`${SITE}/e/quinta`,lastModified:now,changeFrequency:'weekly',priority:.95}]}
