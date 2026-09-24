import { STATUS_DO_DOCUMENTO, STATUS_DO_SIGNATARIO } from '@/constants/status';
import type { StatusDoDocumento, StatusDoSignatario } from '@/lib/api/documentos';
import { Etiqueta } from './Etiqueta';

export function EtiquetaDoDocumento({ status }: { readonly status: StatusDoDocumento }) {
  const { rotulo, tom, icone: Icone } = STATUS_DO_DOCUMENTO[status];

  return (
    <Etiqueta tom={tom} icone={<Icone aria-hidden="true" />}>
      {rotulo}
    </Etiqueta>
  );
}

export function EtiquetaDoSignatario({ status }: { readonly status: StatusDoSignatario }) {
  const { rotulo, tom, icone: Icone } = STATUS_DO_SIGNATARIO[status];

  return (
    <Etiqueta tom={tom} icone={<Icone aria-hidden="true" />}>
      {rotulo}
    </Etiqueta>
  );
}
