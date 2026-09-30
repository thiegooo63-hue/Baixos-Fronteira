const SITE = process.env.NEXT_PUBLIC_SITE_URL || 'https://baixosfronteirajag.vertraweb.app'
export default function robots(){return {rules:[{userAgent:'*',allow:'/',disallow:['/admin']}],sitemap:`${SITE}/sitemap.xml`,host:SITE}}
