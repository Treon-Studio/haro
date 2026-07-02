'use client'

import { useState, useEffect } from 'react'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@treonstudio/bungas-core/ui/accordion'

type FAQ = {
    id: string
    question: string
    answer: string
}

export default function FAQs() {
    const [faqItems, setFaqItems] = useState<FAQ[]>([])
    const [isLoading, setIsLoading] = useState(true)

    useEffect(() => {
        const fetchFaqs = async () => {
            try {
                const res = await fetch('/api/faqs')
                const json = await res.json()
                if (json.success && json.data) {
                    setFaqItems(json.data)
                }
            } catch (err) {
                console.error('Failed to fetch FAQs:', err)
            } finally {
                setIsLoading(false)
            }
        }
        fetchFaqs()
    }, [])

    return (
        <section className="bg-background @container py-24">
            <div className="mx-auto max-w-2xl px-6">
                <h2 className="text-center font-serif text-4xl font-medium">Your Questions Answered</h2>
                
                {isLoading ? (
                    <div className="mt-12 text-center text-muted-foreground">Loading FAQs...</div>
                ) : faqItems.length > 0 ? (
                    <Accordion
                        type="single"
                        collapsible
                        className="mt-12">
                        {faqItems.map((item) => (
                            <div
                                className="group"
                                key={item.id}>
                                <AccordionItem
                                    value={item.id}
                                    className="data-[state=open]:bg-muted/50 peer rounded-xl border-none px-5 py-1 transition-colors">
                                    <AccordionTrigger className="cursor-pointer py-4 text-sm font-medium hover:no-underline text-left">{item.question}</AccordionTrigger>
                                    <AccordionContent>
                                        <p className="text-muted-foreground pb-2 text-sm">{item.answer}</p>
                                    </AccordionContent>
                                </AccordionItem>
                                <hr className="mx-5 group-last:hidden peer-data-[state=open]:opacity-0" />
                            </div>
                        ))}
                    </Accordion>
                ) : (
                    <div className="mt-12 text-center text-muted-foreground">No FAQs available at the moment.</div>
                )}
                
                <p className="text-muted-foreground mt-8 text-center text-sm">
                    Can't find what you're looking for?{' '}
                    <a
                        href="#"
                        className="text-primary font-medium hover:underline">
                        Contact support
                    </a>
                </p>
            </div>
        </section>
    )
}
