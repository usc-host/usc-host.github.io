import { defaultIndex, flavorImage, productDescription } from '@bella/domain';
import { Modal } from 'antd';
import { ProductImage } from '../../components/ui/ProductImage';

/* Photo of a flavor, opened from the eye button next to each choice. */
export function FlavorPreview({ flavorId, onClose }: { flavorId: string | null; onClose: () => void }) {
  const flavor = flavorId ? defaultIndex.flavor(flavorId) : undefined;
  const product = flavor?.productId ? defaultIndex.product(flavor.productId) : undefined;
  const image = flavorId ? flavorImage(defaultIndex, flavorId) : null;
  return (
    <Modal open={!!flavor} onCancel={onClose} footer={null} centered width={480} title={null} className="flavor-preview" destroyOnHidden>
      {flavor && (
        <div className="flavor-preview__body">
          <ProductImage image={image} art="pizza" priority className="flavor-preview__image" />
          <h2>{flavor.name}</h2>
          {(product ? productDescription(product) : flavor.description) && <p className="muted">{product ? productDescription(product) : flavor.description}</p>}
        </div>
      )}
    </Modal>
  );
}
