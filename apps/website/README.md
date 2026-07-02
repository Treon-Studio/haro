# Tenang AI

Shadcn Blocks with a warm, earthy aesthetic for building super minimalistic elegant websites.

## Theme

### Quickstart: Add the Veil Kit Theme

Copy and paste the following CSS variables into your project's global CSS (e.g., `globals.css`). This will enable the Veil Kit theme:

```css
:root {
    --radius: 0.625rem;

    --background: oklch(0.9779 0.0042 56.38);
    --foreground: oklch(0.3421 0.0379 61.15);
    
    --card: var(--color-white);
    --card-foreground: oklch(0.3421 0.0379 61.15);
    
    --popover: var(--color-white);
    --popover-foreground: oklch(0.3421 0.0379 61.15);
    
    --primary: oklch(0.5967 0.0558 61.59);
    --primary-foreground: oklch(0.1448 0 0);
    
    --secondary: --alpha(var(--primary)/15%);
    --secondary-foreground: oklch(0.3421 0.0379 61.15);
    
    --muted: --alpha(var(--foreground)/5%);
    --muted-foreground: oklch(0.4563 0.0061 48.59);
    
    --accent: oklch(0.9068 0.0112 89.73);
    --accent-foreground: oklch(0.3467 0.0231 86.12);
    
    --destructive: var(--color-red-600);
    --destructive-foreground: var(--color-white);

    --border: --alpha(var(--foreground)/7.5%);
    --input: --alpha(var(--foreground)/20%);
    --ring: var(--primary);
}

.dark {
    --background: oklch(0.1448 0 0);
    --foreground: oklch(0.9027 0.0137 60.56);

    --card: oklch(0.1924 0.0016 17.3);
    --card-foreground: oklch(0.9027 0.0137 60.56);
    
    --popover: var(--color-white);
    --popover-foreground: oklch(0.9027 0.0137 60.56);
    
    --primary-foreground: var(--color-white);
    --secondary: --alpha(var(--primary)/10%);
    --secondary-foreground: oklch(0.9027 0.0137 60.56);
    
    --muted: var(--background);
    --muted-foreground: oklch(0.7262 0.0037 67.77);
    
    --accent: var(--color-zinc-700);
    --accent-foreground: var(--color-white);
    
    --input: --alpha(var(--foreground)/15%);
}
```

This enables all Veil Kit components to inherit the correct theme values.

## Button

The Button component features rounded-full styling with a subtle scale animation on click.

### Variants

- `default` / `neutral`: Dark foreground button with light text
- `destructive`: Red destructive action button
- `outline`: Bordered button with subtle shadow
- `secondary`: Secondary styled button
- `ghost`: Transparent background with hover effect
- `link`: Text link style with underline on hover

### Sizes

- `default`: `h-8 px-3`
- `sm`: `h-7 px-2.5`
- `lg`: `h-11 px-6`
- `icon`: `size-9`

**Usage:**
```tsx
<Button variant="default">Default Button</Button>
<Button variant="outline">Outline Button</Button>
<Button size="lg">Large Button</Button>
```

```tsx
import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const buttonVariants = cva('cursor-pointer active:scale-99 duration-200 font-medium inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full text-sm font-medium focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0', {
    variants: {
        variant: {
            default: 'bg-foreground text-background hover:brightness-95',
            neutral: 'bg-foreground text-background hover:brightness-95',
            destructive: 'bg-destructive text-destructive-foreground shadow-md hover:bg-destructive/90',
            outline: 'shadow-sm text-foreground shadow-black/6.5 border border-transparent bg-card ring-1 ring-foreground/15 duration-200 hover:bg-muted/50',
            secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
            ghost: 'hover:bg-foreground/5 text-foreground/75 hover:text-foreground',
            link: 'text-primary underline-offset-4 hover:underline',
        },
        size: {
            default: 'h-8 px-3 py-2',
            sm: 'h-7 px-2.5 text-sm',
            lg: 'h-11 px-6 font-medium text-base',
            icon: 'size-9',
        },
    },
    defaultVariants: {
        variant: 'default',
        size: 'default',
    },
})

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
    asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button'
    return (
        <Comp
            className={cn(buttonVariants({ variant, size, className }))}
            ref={ref}
            {...props}
        />
    )
})
Button.displayName = 'Button'

export { Button, buttonVariants }
```

## Card

The Card component uses `rounded-2xl` styling with elegant shadow and ring effects.

### Variants

- `default`: White card with subtle ring and shadow
- `soft`: Muted background, no border
- `mixed`: Muted background with border
- `outline`: White card with border ring

**Usage:**
```tsx
<Card variant="default">
  <CardHeader>Default Card</CardHeader>
  <CardContent>...</CardContent>
</Card>

<Card variant="soft">
  <CardHeader>Soft Card</CardHeader>
  <CardContent>...</CardContent>
</Card>

<Card variant="outline">
  <CardHeader>Outline Card</CardHeader>
  <CardContent>...</CardContent>
</Card>
```

```tsx
import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const cardVariants = cva('text-card-foreground rounded-2xl', {
    variants: {
        variant: {
            default: 'bg-card ring-1 ring-foreground/6.5 shadow-lg shadow-foreground/5 dark:shadow-black/10',
            soft: 'bg-muted',
            mixed: 'bg-muted border',
            outline: 'bg-card ring-1 ring-border',
        },
    },
    defaultVariants: {
        variant: 'default',
    },
})

export interface CardProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof cardVariants> {}

const Card = React.forwardRef<HTMLDivElement, CardProps>(({ className, variant, ...props }, ref) => (
    <div
        ref={ref}
        className={cn(cardVariants({ variant, className }))}
        {...props}
    />
))
Card.displayName = 'Card'

const CardHeader = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(({ className, ...props }, ref) => (
    <div
        ref={ref}
        className={cn('flex flex-col space-y-1.5 p-6', className)}
        {...props}
    />
))
CardHeader.displayName = 'CardHeader'

const CardTitle = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(({ className, ...props }, ref) => (
    <div
        ref={ref}
        className={cn('font-semibold leading-none tracking-tight', className)}
        {...props}
    />
))
CardTitle.displayName = 'CardTitle'

const CardDescription = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(({ className, ...props }, ref) => (
    <div
        ref={ref}
        className={cn('text-muted-foreground text-sm', className)}
        {...props}
    />
))
CardDescription.displayName = 'CardDescription'

const CardContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(({ className, ...props }, ref) => (
    <div
        ref={ref}
        className={cn('p-6 pt-0', className)}
        {...props}
    />
))
CardContent.displayName = 'CardContent'

const CardFooter = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(({ className, ...props }, ref) => (
    <div
        ref={ref}
        className={cn('flex items-center p-6 pt-0', className)}
        {...props}
    />
))
CardFooter.displayName = 'CardFooter'

export { Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent }
```

## Input

A styled input component with focus ring effects and validation states.

```tsx
import * as React from 'react'
import { cn } from '@/lib/utils'

function Input({ className, type, ...props }: React.ComponentProps<'input'>) {
    return (
        <input
            type={type}
            data-slot="input"
            className={cn(
                'border-input not-dark:bg-card file:text-foreground placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground bg-card md:text-sm flex h-8 w-full min-w-0 rounded-md border px-3 py-1 text-sm outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50',
                'focus-visible:border-ring focus-visible:ring-ring/15 focus-visible:ring-[3px]',
                'aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive',
                className
            )}
            {...props}
        />
    )
}

export { Input }
```

## Textarea

A styled textarea component matching the Input styling.

```tsx
import * as React from 'react'
import { cn } from '@/lib/utils'

function Textarea({ className, ...props }: React.ComponentProps<'textarea'>) {
    return (
        <textarea
            data-slot="textarea"
            className={cn('border-input placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/15 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive field-sizing-content not-dark:bg-card flex min-h-16 w-full rounded-md border px-3 py-2 text-base outline-none transition-colors focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50 md:text-sm', className)}
            {...props}
        />
    )
}

export { Textarea }
```