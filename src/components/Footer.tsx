import { Link } from 'react-router';
import { Icon } from '@iconify/react';
import { icons } from '@/lib/icons';
import { LOGIN_PATH } from '@/const';

const COLUMNS: { title: string; links: { label: string; to: string }[] }[] = [
  {
    title: 'Product',
    links: [
      { label: 'Platform', to: '/platform' },
      { label: 'Pricing', to: '/pricing' },
      { label: 'Sample Report', to: '/sample-report' },
      { label: 'Sign in', to: LOGIN_PATH },
    ],
  },
  {
    title: 'Company',
    links: [
      { label: 'About', to: '/platform' },
      { label: 'Contact', to: 'mailto:hello@ai-search-iq.io' },
    ],
  },
  {
    title: 'Resources',
    links: [
      { label: 'AEO Guide', to: '/platform#methodology' },
      { label: 'FAQ', to: '/#faq' },
      { label: 'Methodology', to: '/platform#methodology' },
    ],
  },
  {
    title: 'Legal',
    links: [
      { label: 'Privacy', to: '/privacy' },
      { label: 'Terms', to: '/terms' },
    ],
  },
];

export default function Footer() {
  return (
    <footer className="bg-ares-tertiary">
      <div className="mx-auto max-w-6xl px-6 py-16">
        <div className="grid grid-cols-2 gap-10 md:grid-cols-6">
          {/* Brand column */}
          <div className="col-span-2">
            <Link to="/" className="flex items-center gap-2.5">
              <Icon icon={icons.radar2} width={20} height={20} className="text-ares-primary" />
              <span className="text-[13px] font-light tracking-[0.02em] text-white">
                AI Search IQ
              </span>
            </Link>
            <p className="mt-4 max-w-[240px] text-[12px] font-light leading-[19.5px] text-white/50">
              AI Visibility Intelligence for the next era of search.
            </p>
            <a
              href="mailto:hello@ai-search-iq.io"
              className="mt-4 inline-block text-[12px] font-light text-white/50 transition-colors duration-200 hover:text-ares-primary"
            >
              hello@ai-search-iq.io
            </a>
          </div>

          {COLUMNS.map((col) => (
            <div key={col.title}>
              <p className="font-label text-white/40">{col.title}</p>
              <ul className="mt-4 space-y-2.5">
                {col.links.map((link) => (
                  <li key={link.label}>
                    {link.to.startsWith('mailto:') ? (
                      <a
                        href={link.to}
                        className="text-[12px] font-light text-white/50 transition-colors duration-200 hover:text-ares-primary"
                      >
                        {link.label}
                      </a>
                    ) : (
                      <Link
                        to={link.to}
                        className="text-[12px] font-light text-white/50 transition-colors duration-200 hover:text-ares-primary"
                      >
                        {link.label}
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="section-rule-dark mt-14" />
        <div className="mt-6 flex items-center justify-between text-[11px] font-light text-white/50">
          <span>© 2026 AI Search IQ</span>
          <span>ai-search-iq.io</span>
        </div>
      </div>
    </footer>
  );
}
