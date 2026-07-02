export type TSupportTicket = {
  readonly id: string
  readonly companyId: string
  readonly subject: string
  readonly description: string
  readonly priority: "low" | "medium" | "high"
  readonly status: "open" | "in_progress" | "resolved" | "closed"
  readonly createdAt: string
  readonly updatedAt: string
}

export type TSupportTicketDto = {
  readonly id: string
  readonly company_id: string
  readonly subject: string
  readonly description: string
  readonly priority: string
  readonly status: string
  readonly created_at: string
  readonly updated_at: string
}

export const toSupportTicketDto = (ticket: TSupportTicket): TSupportTicketDto => ({
  id: ticket.id,
  company_id: ticket.companyId,
  subject: ticket.subject,
  description: ticket.description,
  priority: ticket.priority,
  status: ticket.status,
  created_at: ticket.createdAt,
  updated_at: ticket.updatedAt,
})
