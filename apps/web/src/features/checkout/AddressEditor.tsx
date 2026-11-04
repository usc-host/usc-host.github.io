import { LoadingOutlined } from '@ant-design/icons';
import { normalize } from '@bella/domain';
import { Button, Form, Input, Modal, Segmented, Select, type InputRef } from 'antd';
import { useEffect, useRef, useState } from 'react';
import { BottomSheet } from '../../components/ui/BottomSheet';
import { useIsMobile } from '../../lib/hooks';
import { CITIES, type Address } from './addressBook';
import { cepDigits, formatCep, lookupCep } from './viacep';

type Draft = Omit<Address, 'id'>;

const LABELS = ['Casa', 'Trabalho', 'Outro'];

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

  /* Fills street, district and city from the CEP. The customer can still
     type everything by hand when the CEP is unknown or the service fails. */
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
      const city = CITIES.find(c => normalize(c) === normalize(found.city));
      if (!city) {
        form.setFields([{ name: 'cep', errors: [`Esse CEP é de ${found.city}. Entregamos em Barra Bonita e Igaraçu do Tietê.`] }]);
        return;
      }
      form.setFieldsValue({
        city,
        ...(found.street && { street: found.street }),
        ...(found.district && { district: found.district })
      });
      form.setFields([{ name: 'cep', errors: [] }]);
      if (found.street) numberRef.current?.focus();
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
    form.setFieldsValue(initial ?? { label: 'Casa', city: CITIES[0] } as Partial<Draft>);
  }, [open, initial, form]);

  const body = (
    <Form
      form={form}
      name="address-editor"
      layout="vertical"
      requiredMark={false}
      className="address-form"
      onFinish={values => onSave({ ...values, id: initial?.id })}
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
      <div className="form-row form-row--street">
        <Form.Item name="street" label="Rua" rules={[{ required: true, whitespace: true, message: 'Informe a rua.' }]}>
          <Input size="large" autoComplete="address-line1" maxLength={100} />
        </Form.Item>
        <Form.Item name="number" label="Número" rules={[{ required: true, whitespace: true, message: 'Informe o número.' }]}>
          <Input ref={numberRef} size="large" inputMode="numeric" maxLength={10} />
        </Form.Item>
      </div>
      <div className="form-row">
        <Form.Item name="district" label="Bairro" rules={[{ required: true, whitespace: true, message: 'Informe o bairro.' }]}>
          <Input size="large" maxLength={60} />
        </Form.Item>
        <Form.Item name="city" label="Cidade" rules={[{ required: true }]}>
          <Select size="large" options={CITIES.map(c => ({ value: c, label: c }))} />
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
