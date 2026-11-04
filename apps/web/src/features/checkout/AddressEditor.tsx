import { Button, Form, Input, Modal, Segmented, Select } from 'antd';
import { useEffect } from 'react';
import { BottomSheet } from '../../components/ui/BottomSheet';
import { useIsMobile } from '../../lib/hooks';
import { CITIES, type Address } from './addressBook';

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

  useEffect(() => {
    if (!open) return;
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
      <div className="form-row form-row--street">
        <Form.Item name="street" label="Rua" rules={[{ required: true, whitespace: true, message: 'Informe a rua.' }]}>
          <Input size="large" autoComplete="address-line1" maxLength={100} />
        </Form.Item>
        <Form.Item name="number" label="Número" rules={[{ required: true, whitespace: true, message: 'Informe o número.' }]}>
          <Input size="large" inputMode="numeric" maxLength={10} />
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
