import { LogoIcon } from '@/components/logo'
import { ThemeSwitcher } from './theme-switcher'

const links = [
    { label: 'Features', href: '#' },
    { label: 'Pricing', href: '#' },
    { label: 'About', href: '#' },
    { label: 'Blog', href: '#' },
    { label: 'Contact', href: '#' },
]

export default function Footer() {
    return (
        <footer className="bg-background @container py-12">
            <div className="mx-auto max-w-2xl px-6">
                <div className="flex flex-col">
                    <a
                        href="/"
                        aria-label="go home"
                        className="hover:bg-foreground/5 -ml-1.5 flex size-8 rounded-lg *:m-auto">
                        <LogoIcon
                            uniColor
                            className="w-fit"
                        />
                    </a>
                    <nav className="my-8 flex flex-wrap gap-x-8 gap-y-2">
                        {links.map((link) => (
                            <a
                                key={link.label}
                                href={link.href}
                                className="text-muted-foreground hover:text-foreground text-sm transition-colors">
                                {link.label}
                            </a>
                        ))}
                    </nav>

                    <ThemeSwitcher />

                    <p className="text-muted-foreground mt-2 border-t pt-6 text-sm">&copy; {2026} Veil. </p>
                </div>
            </div>
        </footer>
    )
}
