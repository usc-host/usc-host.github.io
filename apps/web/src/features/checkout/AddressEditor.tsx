import { LoadingOutlined } from '@ant-design/icons';
import { catalog, deliveryOptions, findDeliveryFee, formatBRL, matchesZoneSearch, normalize, type DeliveryZone } from '@bella/domain';
import { Button, Form, Input, Modal, Segmented, Select, type InputRef } from 'antd';
import { useEffect, useMemo, useRef, useState } from 'react';
import { BottomSheet } from '../../components/ui/BottomSheet';
import { useIsMobile } from '../../lib/hooks';
import { CITIES, type Address } from './addressBook';
import { cepDigits, formatCep, lookupCep } from './viacep';

type Draft = Omit<Address, 'id'>;

const LABELS = ['Casa', 'Trabalho', 'Outro'];

/* The store's own zone for a free-text district, when there is exactly one. */
function matchZone(district: string | undefined, city: string): DeliveryZone | undefined {
  if (!district) return undefined;
  const r = findDeliveryFee(catalog.store, district, city);
  return r.status === 'found' ? r.zone : undefined;
}

/* Add or edit one address, in a sheet on phones and a dialog on larger screens. */
export function AddressEditor({ open, initial, onClose, onSave }: {
  open: boolean;
  initial: Address | null;
  onClose: () => void;
  onSave: (draft: Draft & { id?: string }) => void;
}) {
  const mobile = useIsMobile();
  const [form] = Form.useForm<Draft>();
  const title = initial ? 'Editar endereço' : 'Novo endereço';
  const numberRef = useRef<InputRef>(null);
  const lookup = useRef<AbortController | null>(null);
  const [searching, setSearching] = useState(false);
  const city = Form.useWatch('city', form) ?? CITIES[0];
  const zones = useMemo(() => deliveryOptions(catalog.store, city), [city]);

  /* Fills street, city and, when it matches the store's list, the
     neighborhood. The customer can still fill everything by hand when the
     CEP is unknown or the service fails. */
  async function fillFromCep(value: string) {
    lookup.current?.abort();
    if (cepDigits(value).length !== 8) return;
    const controller = new AbortController();
    lookup.current = controller;
    setSearching(true);
    try {
      const found = await lookupCep(value, controller.signal);
      if (controller.signal.aborted) return;
      if (!found) {
        form.setFields([{ name: 'cep', errors: ['CEP não encontrado. Preencha o endereço abaixo.'] }]);
        return;
      }
      const foundCity = CITIES.find(c => normalize(c) === normalize(found.city));
      if (!foundCity) {
        form.setFields([{ name: 'cep', errors: [`Esse CEP é de ${found.city}. Entregamos em Barra Bonita e Igaraçu do Tietê.`] }]);
        return;
      }
      const zone = matchZone(found.district, foundCity);
      form.setFieldsValue({ city: foundCity, zoneId: zone?.id, ...(found.street && { street: found.street }) });
      form.setFields([{ name: 'cep', errors: [] }]);
      if (found.street && zone) numberRef.current?.focus();
    } catch {
      if (!controller.signal.aborted) form.setFields([{ name: 'cep', errors: ['Não deu para buscar o CEP agora. Preencha o endereço abaixo.'] }]);
    } finally {
      if (lookup.current === controller) setSearching(false);
    }
  }

  useEffect(() => {
    if (!open) return;
    lookup.current?.abort();
    setSearching(false);
    form.resetFields();
    // Addresses saved before the neighborhood list get matched by name.
    form.setFieldsValue(initial
      ? { ...initial, zoneId: initial.zoneId ?? matchZone(initial.district, initial.city)?.id }
      : { label: 'Casa', city: CITIES[0] } as Partial<Draft>);
  }, [open, initial, form]);

  const body = (
    <Form
      form={form}
      name="address-editor"
      layout="vertical"
      requiredMark={false}
      className="address-form"
      onValuesChange={changed => {
        if ('city' in changed) form.setFieldsValue({ zoneId: undefined });
      }}
      onFinish={values => {
        const zone = zones.find(z => z.id === values.zoneId);
        onSave({ ...values, district: zone?.name ?? values.district, id: initial?.id });
      }}
    >
      <Form.Item name="label" label="Identificação">
        <Segmented block options={LABELS} />
      </Form.Item>
      <div className="form-row form-row--cep">
        <Form.Item
          name="cep"
          label="CEP"
          normalize={formatCep}
          rules={[{ pattern: /^\d{5}-\d{3}$/, message: 'CEP com 8 números.' }]}
        >
          <Input
            size="large"
            type="tel"
            inputMode="numeric"
            autoComplete="postal-code"
            placeholder="00000-000"
            maxLength={9}
            suffix={searching ? <LoadingOutlined /> : <span />}
            onChange={e => fillFromCep(e.target.value)}
          />
        </Form.Item>
        <a className="text-link address-form__cep-help" href="https://buscacepinter.correios.com.br/app/endereco/index.php" target="_blank" rel="noreferrer">
          Não sei meu CEP
        </a>
      </div>
      <div className="form-row form-row--zone">
        <Form.Item name="city" label="Cidade" rules={[{ required: true }]}>
          <Select size="large" options={CITIES.map(c => ({ value: c, label: c }))} />
        </Form.Item>
        <Form.Item name="zoneId" label="Bairro ou condomínio" rules={[{ required: true, message: 'Escolha o bairro.' }]}>
          <Select
            size="large"
            placeholder="Escolha seu bairro"
            showSearch={{
              filterOption: (input, option) => matchesZoneSearch(String(option?.name ?? ''), input)
            }}
            notFoundContent="Bairro não encontrado. Fale com a loja pelo WhatsApp."
            options={zones.map(z => ({
              value: z.id,
              name: z.name,
              label: (
                <span className="zone-option">
                  <span className="zone-option__name">{z.name}</span>
                  <span className="zone-option__fee">{formatBRL(z.feeCents)}</span>
                </span>
              )
            }))}
          />
        </Form.Item>
      </div>
      <div className="form-row form-row--street">
        <Form.Item name="street" label="Rua" rules={[{ required: true, whitespace: true, message: 'Informe a rua.' }]}>
          <Input size="large" autoComplete="address-line1" maxLength={100} />
        </Form.Item>
        <Form.Item name="number" label="Número" rules={[{ required: true, whitespace: true, message: 'Informe o número.' }]}>
          <Input ref={numberRef} size="large" inputMode="numeric" maxLength={10} />
        </Form.Item>
      </div>
      <Form.Item name="complement" label="Complemento">
        <Input size="large" placeholder="Apartamento, bloco, casa dos fundos" maxLength={60} />
      </Form.Item>
      <Form.Item name="reference" label="Ponto de referência">
        <Input size="large" placeholder="Perto de..." maxLength={80} />
      </Form.Item>
      <Button type="primary" htmlType="submit" size="large" shape="round" block>Salvar endereço</Button>
    </Form>
  );

  return mobile ? (
    <BottomSheet open={open} onClose={onClose} title={title}>{body}</BottomSheet>
  ) : (
    <Modal open={open} onCancel={onClose} footer={null} centered width={520} title={title} className="auth-modal" destroyOnHidden>
      {body}
    </Modal>
  );
}
