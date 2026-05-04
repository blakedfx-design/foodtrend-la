import type { ReactNode } from "react";

export type SidebarCardProps = {
  title: string;
  id?: string;
  titleIcon?: ReactNode;
  children: ReactNode;
};

export function SidebarCard({ title, id, titleIcon, children }: SidebarCardProps) {
  return (
    <section className="sidebar-card" id={id}>
      <h3 className="sidebar-card__title">
        {titleIcon ? (
          <>
            <span className="sidebar-card__title-icon-wrap" aria-hidden>
              {titleIcon}
            </span>
            <span>{title}</span>
          </>
        ) : (
          title
        )}
      </h3>
      <div className="sidebar-card__body">{children}</div>
    </section>
  );
}
