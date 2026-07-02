import { Logo } from '@/components/logo'

const links = {
    product: [
        { label: 'Features', href: '#' },
        { label: 'Integrations', href: '#' },
        { label: 'Pricing', href: '#' },
        { label: 'Changelog', href: '#' },
    ],
    company: [
        { label: 'About', href: '#' },
        { label: 'Blog', href: '#' },
        { label: 'Careers', href: '#' },
        { label: 'Contact', href: '#' },
    ],
    resources: [
        { label: 'Documentation', href: '#' },
        { label: 'Help Center', href: '#' },
        { label: 'Community', href: '#' },
        { label: 'Templates', href: '#' },
    ],
    legal: [
        { label: 'Privacy', href: '#' },
        { label: 'Terms', href: '#' },
        { label: 'Cookie Policy', href: '#' },
    ],
}

export default function Footer() {
    return (
        <footer className="bg-background @container border-t py-12">
            <div className="mx-auto max-w-2xl px-6">
                <div className="@sm:grid-cols-3 grid grid-cols-2 gap-8">
                    <div className="col-span-full">
                        <a
                            href="/"
                            className="flex items-center gap-2">
                            <Logo className="h-5 w-fit" />
                        </a>
                        <p className="text-muted-foreground mt-4 max-w-xs text-sm">Building the future of integrations. Connect your tools, automate your workflow.</p>
                    </div>
                    <div>
                        <h3 className="text-foreground mb-3 text-sm font-medium">Product</h3>
                        <ul className="space-y-2">
                            {links.product.map((link) => (
                                <li key={link.label}>
                                    <a
                                        href={link.href}
                                        className="text-muted-foreground hover:text-foreground text-sm transition-colors">
                                        {link.label}
                                    </a>
                                </li>
                            ))}
                        </ul>
                    </div>
                    <div>
                        <h3 className="text-foreground mb-3 text-sm font-medium">Company</h3>
                        <ul className="space-y-2">
                            {links.company.map((link) => (
                                <li key={link.label}>
                                    <a
                                        href={link.href}
                                        className="text-muted-foreground hover:text-foreground text-sm transition-colors">
                                        {link.label}
                                    </a>
                                </li>
                            ))}
                        </ul>
                    </div>
                    <div>
                        <h3 className="text-foreground mb-3 text-sm font-medium">Resources</h3>
                        <ul className="space-y-2">
                            {links.resources.map((link) => (
                                <li key={link.label}>
                                    <a
                                        href={link.href}
                                        className="text-muted-foreground hover:text-foreground text-sm transition-colors">
                                        {link.label}
                                    </a>
                                </li>
                            ))}
                        </ul>
                    </div>
                </div>
                <div className="mt-12 flex flex-wrap items-center justify-between gap-4 border-t pt-8">
                    <p className="text-muted-foreground text-sm">&copy; {2026} Veil. All rights reserved.</p>
                    <div className="flex gap-4">
                        {links.legal.map((link) => (
                            <a
                                key={link.label}
                                href={link.href}
                                className="text-muted-foreground hover:text-foreground text-sm transition-colors">
                                {link.label}
                            </a>
                        ))}
                    </div>
                </div>
            </div>
        </footer>
    )
}
