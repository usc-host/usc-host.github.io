import { ArrowLeftOutlined, RightOutlined } from '@ant-design/icons';
import { Fragment } from 'react';
import { Link, useNavigate } from 'react-router';

export interface Crumb {
  label: string;
  to?: string;
}

/* Back button plus breadcrumbs. Back follows the browser history when the
   visitor came from inside the site, otherwise goes to the parent page. */
export function PageNav({ trail, fallback }: { trail: Crumb[]; fallback: string }) {
  const navigate = useNavigate();
  const parent = [...trail].reverse().find(c => c.to)?.label ?? 'Voltar';

  function back() {
    const idx = (window.history.state as { idx?: number } | null)?.idx ?? 0;
    if (idx > 0) navigate(-1);
    else navigate(fallback);
  }

  return (
    <div className="page-nav">
      <button type="button" className="page-nav__back" onClick={back} aria-label={`Voltar para ${parent}`}>
        <ArrowLeftOutlined />
      </button>
      <nav aria-label="Você está em">
        <ol className="crumbs">
          {trail.map((c, i) => (
            <Fragment key={`${c.label}-${i}`}>
              {i > 0 && <li aria-hidden="true" className="crumbs__sep"><RightOutlined /></li>}
              <li>
                {c.to && i < trail.length - 1 ? <Link to={c.to}>{c.label}</Link> : <span aria-current="page">{c.label}</span>}
              </li>
            </Fragment>
          ))}
        </ol>
      </nav>
    </div>
  );
}
