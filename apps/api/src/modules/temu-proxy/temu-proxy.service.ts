import { Injectable } from '@nestjs/common';
import { TemuClientFactoryService } from '../platform/temu/temu-client-factory.service';

export interface TemuCategory {
  catId: number;
  catName: string;
  isLeaf: boolean;
}

@Injectable()
export class TemuProxyService {
  constructor(private clientFactory: TemuClientFactoryService) {}

  async getCategoryChildren(shopId: string, parentCatId: number): Promise<TemuCategory[]> {
    const client = await this.clientFactory.forShop(shopId);
    const res: any = await client.call('bg.goods.cats.get', { parentCatId });
    const list = res?.categoryDTOList ?? res?.goodsCatsList ?? res?.list ?? [];
    return (list as any[]).map((c) => ({
      catId: Number(c.catId),
      catName: String(c.catName ?? c.catEnName ?? ''),
      isLeaf: !!c.isLeaf,
    }));
  }

  async getCategoryAttrs(shopId: string, catId: number): Promise<any> {
    const client = await this.clientFactory.forShop(shopId);
    return await client.call('bg.goods.attrs.get', { catId });
  }

  async uploadImage(shopId: string, imageBase64: string, filename?: string): Promise<{ url: string }> {
    const client = await this.clientFactory.forShop(shopId);
    const res: any = await client.call('bg.goods.image.upload.global', {
      imageBase64,
      fileName: filename,
    });
    const url = res?.url ?? res?.imageUrl ?? res?.fullUrl;
    if (!url) throw new Error(`Temu image upload returned no url: ${JSON.stringify(res)}`);
    return { url };
  }
}
