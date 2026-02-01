'use client';

import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { getCompanyBySlug, getCompanyProducts, getCompanyProductById } from '@/lib/api';
import type { Product } from '@/types/api/products';
import type { Company } from '@/types/api/companies';

import Pagination from '@/components/Layouts/Pagination';
import TableDefault, { Column } from '@/components/Tables/TableDefault';
import ProductForm from '@/components/Forms/ProductForm';
import ModalWindowDefault from '@/components/ModalWindows/ModalWindowDefault';
import ButtonDefault from '@/components/Buttons/ButtonDefault';
import SearchInput from '@/components/Inputs/SearchInput';
import { formatMoney, formatMeasure } from '@/lib/decimal';

import { Pencil, Eye } from 'lucide-react';

export default function TenantProductsPage() {
  const params = useParams<{ tenant: string }>();
  const [slug, setSlug] = useState<string | null>(null);

  const [company, setCompany] = useState<Company | null>(null);
  const [companyId, setCompanyId] = useState<string | undefined>(undefined);
  const [companyLoading, setCompanyLoading] = useState(false);

  const [products, setProducts] = useState<Product[]>([]);
  const [count, setCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(10);
  const [search, setSearch] = useState<string>('');

  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalLoading, setModalLoading] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    const tenantValue = Array.isArray(params?.tenant) ? params?.tenant?.[0] : params?.tenant;
    if (tenantValue) {
      setSlug(String(tenantValue));
    }
  }, [params?.tenant]);

  const fetchCompany = async (tenantSlug: string) => {
    setCompanyLoading(true);
    setError(null);
    try {
      const companyResp = await getCompanyBySlug(tenantSlug);
      setCompany(companyResp);
      setCompanyId(companyResp?.id ? String(companyResp.id) : undefined);
    } catch (err) {
      console.error('getCompanyBySlug error:', err);
      setError('Не удалось загрузить компанию');
      setCompany(null);
      setCompanyId(undefined);
    } finally {
      setCompanyLoading(false);
    }
  };

  const fetchProducts = async (id: string, page = currentPage, ps = pageSize, q = search) => {
    setLoading(true);
    setError(null);
    try {
      const res = await getCompanyProducts(id, { page, page_size: ps, search: q });
      setProducts(res.results);
      setCount(res.count);
    } catch (err) {
      console.error('getCompanyProducts error:', err);
      setError('Не удалось загрузить продукты');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!slug) return;
    fetchCompany(slug);
  }, [slug]);

  useEffect(() => {
    if (!companyId) {
      setProducts([]);
      setCount(0);
      return;
    }
    fetchProducts(companyId);
  }, [companyId, currentPage, pageSize, search]);

  const renderStock = (qty?: number) => {
    if (qty === undefined || qty === null) return '';
    if (Number(qty) === -1) return '∞';
    return String(qty);
  };

  const openViewModal = async (productId: string) => {
    if (!companyId) return;
    setIsModalOpen(true);
    setModalLoading(true);
    setModalError(null);
    setSelectedProduct(null);
    setIsEditing(false);

    try {
      const item = await getCompanyProductById(companyId, productId);
      setSelectedProduct(item);
    } catch (err) {
      console.error('getCompanyProductById error:', err);
      setModalError('Не удалось загрузить продукт');
    } finally {
      setModalLoading(false);
    }
  };

  const openEditModal = async (productId: string) => {
    if (!companyId) return;
    setIsModalOpen(true);
    setModalLoading(true);
    setModalError(null);
    setSelectedProduct(null);
    setIsEditing(true);

    try {
      const item = await getCompanyProductById(companyId, productId);
      setSelectedProduct(item);
    } catch (err) {
      console.error('getCompanyProductById error:', err);
      setModalError('Не удалось загрузить продукт');
    } finally {
      setModalLoading(false);
    }
  };

  const openCreateModal = () => {
    setSelectedProduct(null);
    setIsEditing(true);
    setModalError(null);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setSelectedProduct(null);
    setModalError(null);
    setIsEditing(false);
  };

  const columns: Column<Product>[] = [
    { key: 'name', label: 'Название' },
    {
      key: 'price_currency',
      label: 'Цена',
      render: (r) => [formatMoney(r.price), r.currency].filter(Boolean).join(' '),
    },
    {
      key: 'stock_quantity',
      label: 'Остаток',
      render: (r) => renderStock(r.stock_quantity),
    },
    { key: 'unit', label: 'Ед. изм.' },
    {
      key: 'active',
      label: 'Активен',
      render: (r) => (r.active ? 'Да' : 'Нет'),
    },
    {
      key: 'actions',
      label: 'Действия',
      render: (row: Product) => (
        <div className='flex gap-2'>
          <ButtonDefault
            onClick={(e) => {
              e.stopPropagation();
              openViewModal(String(row.id));
            }}
            type='button'
          >
            <Eye />
          </ButtonDefault>

          <ButtonDefault
            onClick={(e) => {
              e.stopPropagation();
              openEditModal(String(row.id));
            }}
            type='button'
          >
            <Pencil />
          </ButtonDefault>
        </div>
      ),
      className: 'w-40',
    },
  ];

  const handlePageChange = (page: number, newPageSize?: number) => {
    if (newPageSize && newPageSize !== pageSize) {
      setPageSize(newPageSize);
      setCurrentPage(1);
    } else {
      setCurrentPage(page);
    }
  };

  const handleSearch = (q: string) => {
    setSearch(q);
    setCurrentPage(1);
  };

  return (
    <>
      <section className='mb-6 flex justify-between'>
        <div>
          <h1 className='text-2xl font-semibold'>Продукты</h1>
          <p className='text-sm text-gray-500'>
            {companyLoading ? 'Загрузка...' : company ? `Всего продуктов: ${count}` : 'Не удалось определить компанию'}
          </p>
        </div>
        <div className='content-center'>
          <ButtonDefault onClick={openCreateModal} variant='positive'>
            Добавить
          </ButtonDefault>
        </div>
      </section>

      <div className='mb-4 space-y-4'>
        <SearchInput initialValue={search} onSearch={handleSearch} placeholder='Поиск по названию и описанию' />
      </div>

      {error && <p className='text-red-600 mb-4'>{error}</p>}

      <div className='mb-4'>
        {!companyId ? (
          <div className='text-gray-600 p-6 bg-white/5 rounded'>Компания не найдена</div>
        ) : loading ? (
          <div className='p-6 bg-white/5 rounded text-gray-500'>Загрузка...</div>
        ) : products.length === 0 ? (
          <div className='text-gray-600 p-6 bg-white/5 rounded'>
            {search ? 'Нет продуктов, соответствующих запросу.' : 'Нет продуктов для этой компании.'}
          </div>
        ) : (
          <TableDefault<Product> columns={columns} data={products} className='bg-transparent' />
        )}
      </div>

      {companyId && <Pagination currentPage={currentPage} pageSize={pageSize} total={count} onPageChange={handlePageChange} />}

      <ModalWindowDefault isOpen={isModalOpen} onClose={closeModal} showCloseIcon>
        <div>
          {isEditing ? (
            <>
              <h2 className='text-xl font-semibold mb-4'>{selectedProduct ? 'Редактирование продукта' : 'Новый продукт'}</h2>

              {modalLoading && <div className='text-sm text-gray-500'>Загрузка...</div>}

              {modalError && <div className='text-sm text-red-600'>{modalError}</div>}

              {!modalLoading && (
                <ProductForm
                  product={selectedProduct}
                  fixedCompanyId={companyId}
                  onCancel={closeModal}
                  onSuccess={async () => {
                    closeModal();
                    if (companyId) await fetchProducts(companyId, currentPage, pageSize, search);
                  }}
                />
              )}
            </>
          ) : (
            <>
              <h2 className='text-xl font-semibold mb-4'>Просмотр продукта</h2>

              {modalLoading && <div className='text-sm text-gray-500'>Загрузка...</div>}

              {modalError && <div className='text-sm text-red-600'>{modalError}</div>}

              {!modalLoading &&
                selectedProduct &&
                (() => {
                  const fields = [
                    { label: 'ID', value: selectedProduct.id },
                    { label: 'Название', value: selectedProduct.name },
                    { label: 'Описание', value: selectedProduct.description },
                    {
                      label: 'Цена',
                      value: `${formatMoney(selectedProduct.price)} ${selectedProduct.currency}`,
                    },
                    { label: 'Остаток', value: renderStock(selectedProduct.stock_quantity) },
                    { label: 'Мин. остаток', value: selectedProduct.min_stock_level },
                    { label: 'Ед. изм.', value: selectedProduct.unit },
                    {
                      label: 'Себестоимость',
                      value: formatMoney(selectedProduct.cost_price ?? ''),
                    },
                    { label: 'Вес, кг', value: formatMeasure(selectedProduct.weight ?? '') },
                    { label: 'Объем, м³', value: formatMeasure(selectedProduct.volume ?? '') },
                    { label: 'Активен', value: selectedProduct.active ? 'Да' : 'Нет' },
                    { label: 'Создан', value: selectedProduct.created_at ?? '' },
                    { label: 'Обновлен', value: selectedProduct.updated_at ?? '' },
                  ];

                  return (
                    <div className='space-y-2 text-sm text-gray-800'>
                      {fields.map((f) => (
                        <div key={f.label}>
                          <strong>{f.label}:</strong> {String(f.value ?? '')}
                        </div>
                      ))}
                    </div>
                  );
                })()}
            </>
          )}
        </div>
      </ModalWindowDefault>
    </>
  );
}
