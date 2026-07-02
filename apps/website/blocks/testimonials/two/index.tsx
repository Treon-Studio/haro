'use client'

import { useState, useEffect } from 'react'
import { Card } from '@/components/ui/card'

type Testimonial = {
    id: string
    avatar: string
    name: string
    role: string
    quote: string
}

export default function Testimonials() {
    const [testimonials, setTestimonials] = useState<Testimonial[]>([])
    const [isLoading, setIsLoading] = useState(true)

    useEffect(() => {
        const fetchTestimonials = async () => {
            try {
                const res = await fetch('/api/testimonials')
                const json = await res.json()
                if (json.success && json.data) setTestimonials(json.data)
            } catch (err) {
                console.error('Failed to fetch testimonials:', err)
            } finally {
                setIsLoading(false)
            }
        }
        fetchTestimonials()
    }, [])

    return (
        <section className="bg-background @container py-24">
            <div className="mx-auto max-w-2xl px-6">
                <div className="space-y-4">
                    <h2 className="text-balance font-serif text-4xl font-medium">What Our Customers Say</h2>
                    <p className="text-muted-foreground text-balance">Hear from the teams and individuals who have transformed their workflow with our platform.</p>
                </div>
                
                {isLoading ? (
                    <div className="mt-12 text-center text-muted-foreground">Loading testimonials...</div>
                ) : (
                    <div className="@xl:grid-cols-2 mt-12 grid gap-3">
                        {testimonials.map((testimonial) => (
                            <Card
                                key={testimonial.id}
                                variant="outline"
                                className="text-foreground flex items-end gap-3 rounded-2xl p-4 text-sm">
                                <div className="before:border-foreground/10 relative size-5 shrink-0 rounded-full before:absolute before:inset-0 before:rounded-full before:border">
                                    <img
                                        src={testimonial.avatar}
                                        alt={testimonial.name}
                                        className="rounded-full object-cover"
                                        width={40}
                                        height={40}
                                    />
                                </div>
                                <div className="space-y-6">
                                    <p className="text-foreground text-lg">{testimonial.quote}</p>

                                    <div className="space-y-1">
                                        <p className="text-muted-foreground text-sm font-medium">{testimonial.name}</p>
                                        <p className="text-muted-foreground text-xs">{testimonial.role}</p>
                                    </div>
                                </div>
                            </Card>
                        ))}
                    </div>
                )}
            </div>
        </section>
    )
}
