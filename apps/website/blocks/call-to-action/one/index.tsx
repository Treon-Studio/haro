import { Button } from '@/components/ui/button'
import { AltArrowRightLinear } from 'solar-icon-set';

export default function CallToAction() {
    return (
        <section className="bg-background @container py-24">
            <div className="mx-auto max-w-2xl px-6">
                <div className="text-center">
                    <h2 className="text-balance font-serif text-4xl font-medium">Ready to Get Started?</h2>
                    <p className="text-muted-foreground mx-auto mt-4 max-w-md text-balance">Join thousands of teams already using our platform to build better products faster.</p>
                    <div className="mt-6 flex flex-wrap justify-center gap-3">
                        <Button
                            asChild
                            className="pr-1.5">
                            <a href="#link">
                                <span>Start Free Trial</span>
                                <AltArrowRightLinear className="opacity-50" />
                            </a>
                        </Button>
                        <Button
                            variant="secondary"
                            asChild>
                            <a href="#link">Talk to Sales</a>
                        </Button>
                    </div>
                </div>
            </div>
        </section>
    )
}
