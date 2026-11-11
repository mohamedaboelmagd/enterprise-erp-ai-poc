export interface DomainEvent {
  id: string;
  tenantId: string;
  type: string;
  at: string;
  actorId: string;
  entityType: string;
  entityId: string;
  payload: Record<string, unknown>;
}

export type EventHandler = (event: DomainEvent) => void;

export class EventBus {
  private handlers: EventHandler[] = [];
  private log: DomainEvent[] = [];

  tap(handler: EventHandler): () => void {
    this.handlers.push(handler);
    return () => {
      this.handlers = this.handlers.filter((h) => h !== handler);
    };
  }

  publish(event: DomainEvent): void {
    this.log.unshift(event);
    if (this.log.length > 500) this.log.pop();
    for (const h of this.handlers) h(event);
  }

  recent(tenantId: string, limit = 100): DomainEvent[] {
    return this.log.filter((e) => e.tenantId === tenantId).slice(0, limit);
  }
}
