import { Logo } from '@/components/logo'

const links = [
    { label: 'Home', href: '#' },
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
                <div className="border-y py-8">
                    <div className="@xl:flex-row @xl:items-center flex flex-col gap-6">
                        <a
                            href="/"
                            aria-label="home">
                            <Logo className="h-5 w-fit" />
                        </a>
                        <nav className="@xl:ml-auto flex flex-wrap gap-x-6 gap-y-2">
                            {links.map((link) => (
                                <a
                                    key={link.label}
                                    href={link.href}
                                    className="text-muted-foreground hover:text-foreground text-sm transition-colors">
                                    {link.label}
                                </a>
                            ))}
                        </nav>
                    </div>
                </div>
                <div className="@xl:flex-row @xl:justify-between flex flex-col-reverse gap-4 pt-8">
                    <p className="text-muted-foreground text-sm">&copy; {2026} Veil.</p>
                    <div className="flex flex-wrap gap-4">
                        <a
                            href="#"
                            className="text-muted-foreground hover:text-foreground text-sm transition-colors">
                            Privacy Policy
                        </a>
                        <a
                            href="#"
                            className="text-muted-foreground hover:text-foreground text-sm transition-colors">
                            Terms of Service
                        </a>
                        <a
                            href="#"
                            className="text-muted-foreground hover:text-foreground text-sm transition-colors">
                            Cookies
                        </a>
                    </div>
                </div>
            </div>
        </footer>
    )
}
