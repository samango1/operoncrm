'use client';

import React, { useEffect, useMemo, useState } from 'react';
import type { Product } from '@/types/api/products';
import type { Company } from '@/types/api/companies';
import { getCompanies, getCompanyBySlug, getCompanyProducts, getCompanyProductById } from '@/lib/api';

import TableDefault, { Column } from '@/components/Tables/TableDefault';
import Pagination from '@/components/Layouts/Pagination';
import ModalWindowDefault from '@/components/ModalWindows/ModalWindowDefault';
import ButtonDefault from '@/components/Buttons/ButtonDefault';
import SearchInput from '@/components/Inputs/SearchInput';
import SelectOption from '@/components/Inputs/SelectOption';
import ProductForm from '@/components/Forms/ProductForm';
import { formatMoney, formatMeasure } from '@/lib/decimal';

import { Pencil, Eye } from 'lucide-react';

type ProductsPageProps = {
  tenantSlug?: string;
};

export default function ProductsPage({ tenantSlug }: ProductsPageProps) {
  const [products, setProducts] = useState<Product[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [tenantCompany, setTenantCompany] = useState<Company | null>(null);
  const [companyLoading, setCompanyLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [selectedCompanyId, setSelectedCompanyId] = useState<string | undefined>(undefined);
  const [globalSearch, setGlobalSearch] = useState<string>('');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(10);
  const [totalCount, setTotalCount] = useState<number>(0);

  const [isCreateOpen, setIsCreateOpen] = useState(false);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [modalLoading, setModalLoading] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  const isTenantMode = Boolean(tenantSlug);

  const fetchCompanies = async () => {
    try {
      const companiesRes = await getCompanies({ page: 1, page_size: 1000 });
      setCompanies(companiesRes.results as Company[]);
    } catch (err) {
      console.error('fetchCompanies error:', err);
      setError('Не удалось загрузить компании');
    }
  };

  const fetchProducts = async (companyId: string, page = currentPage, ps = pageSize, search = globalSearch) => {
    if (!companyId) {
      setProducts([]);
      setTotalCount(0);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const res = await getCompanyProducts(companyId, { page, page_size: ps, search });
      setProducts(res.results as Product[]);
      setTotalCount(res.count);
    } catch (err) {
      console.error('fetchProducts error:', err);
      setError('Не удалось загрузить продукты');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isTenantMode) return;
    fetchCompanies();
  }, [isTenantMode]);

  useEffect(() => {
    if (!tenantSlug) return;
    const fetchTenantCompany = async () => {
      setCompanyLoading(true);
      setError(null);
      setTenantCompany(null);
      setSelectedCompanyId(undefined);
      try {
        const companyRes = await getCompanyBySlug(tenantSlug);
        setTenantCompany(companyRes as Company);
        setSelectedCompanyId(companyRes?.id ? String(companyRes.id) : undefined);
      } catch (err) {
        console.error('getCompanyBySlug error:', err);
        setError('Не удалось загрузить компанию');
        setTenantCompany(null);
        setSelectedCompanyId(undefined);
      } finally {
        setCompanyLoading(false);
      }
    };
    fetchTenantCompany();
  }, [tenantSlug]);

  useEffect(() => {
    if (selectedCompanyId) {
      fetchProducts(selectedCompanyId, currentPage, pageSize, globalSearch);
    } else {
      setProducts([]);
      setTotalCount(0);
    }
  }, [selectedCompanyId, currentPage, pageSize, globalSearch]);

  const selectedCompany = useMemo(() => {
    if (isTenantMode) return tenantCompany ?? undefined;
    if (!selectedCompanyId) return undefined;
    return companies.find((c) => String(c.id) === String(selectedCompanyId));
  }, [isTenantMode, tenantCompany, selectedCompanyId, companies]);

  const renderStock = (qty?: number) => {
    if (qty === undefined || qty === null) return '';
    if (Number(qty) === -1) return '∞';
    return String(qty);
  };

  const openViewModal = async (productId: string) => {
    if (!selectedCompanyId) return;
    setIsModalOpen(true);
    setIsEditing(false);
    setSelectedProduct(null);
    setModalLoading(true);
    setModalError(null);
    try {
      const item = await getCompanyProductById(selectedCompanyId, productId);
      setSelectedProduct(item as Product);
    } catch (err) {
      console.error('getCompanyProductById error:', err);
      setModalError('Не удалось загрузить продукт');
    } finally {
      setModalLoading(false);
    }
  };

  const openEditModal = async (productId: string) => {
    if (!selectedCompanyId) return;
    setIsModalOpen(true);
    setIsEditing(true);
    setSelectedProduct(null);
    setModalLoading(true);
    setModalError(null);
    try {
      const item = await getCompanyProductById(selectedCompanyId, productId);
      setSelectedProduct(item as Product);
    } catch (err) {
      console.error('getCompanyProductById error:', err);
      setModalError('Не удалось загрузить продукт');
    } finally {
      setModalLoading(false);
    }
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
      render: (r) => {
        const formatted = formatMoney(r.price);
        return [formatted, r.currency].filter(Boolean).join(' ');
      },
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
            onClick={(e: React.MouseEvent) => {
              e.stopPropagation();
              openViewModal(String(row.id));
            }}
            type='button'
          >
            <Eye />
          </ButtonDefault>

          <ButtonDefault
            onClick={(e: React.MouseEvent) => {
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

  const openCreate = () => {
    setIsCreateOpen(true);
  };

  const closeCreate = () => {
    setIsCreateOpen(false);
  };

  const onCreated = async () => {
    closeCreate();
    if (selectedCompanyId) await fetchProducts(selectedCompanyId, currentPage, pageSize, globalSearch);
  };

  const handlePageChange = (page: number, newPageSize?: number) => {
    if (newPageSize && newPageSize !== pageSize) {
      setPageSize(newPageSize);
      setCurrentPage(1);
    } else {
      setCurrentPage(page);
    }
  };

  const handleSearch = (q: string) => {
    setGlobalSearch(q);
    setCurrentPage(1);
  };

  const companyOptions = useMemo(() => {
    return companies.map((c) => ({
      value: String(c.id),
      label: c.name || c.slug || String(c.id),
    }));
  }, [companies]);

  const headerSubtitle = isTenantMode
    ? companyLoading
      ? 'Загрузка...'
      : tenantCompany
        ? `Всего продуктов: ${totalCount}`
        : 'Не удалось определить компанию'
    : selectedCompanyId
      ? `Всего продуктов: ${totalCount}`
      : 'Выберите компанию для просмотра продуктов';

  return (
    <>
      <section className='mb-6 flex justify-between items-center'>
        <div>
          <h1 className='text-2xl font-semibold'>Продукты</h1>
          <p className='text-sm text-gray-500'>{headerSubtitle}</p>
        </div>

        <ButtonDefault
          type='button'
          variant='positive'
          onClick={() => {
            if (!selectedCompanyId) {
              alert(isTenantMode ? 'Компания не найдена' : 'Сначала выберите компанию');
              return;
            }
            openCreate();
          }}
        >
          Добавить
        </ButtonDefault>
      </section>

      <div className='mb-4 space-y-4'>
        {!isTenantMode && (
          <div>
            <SelectOption
              label='Компания'
              placeholder='Выберите компанию'
              options={companyOptions}
              value={selectedCompanyId}
              onChange={(value) => {
                setSelectedCompanyId(value);
                setCurrentPage(1);
                setGlobalSearch('');
              }}
            />
          </div>
        )}

        {(isTenantMode || selectedCompanyId) && (
          <div className='flex items-center justify-between gap-4'>
            <SearchInput initialValue={globalSearch} onSearch={handleSearch} placeholder='Поиск по названию и описанию' />
          </div>
        )}
      </div>

      {error && <div className='text-red-600 mb-4'>{error}</div>}

      {!selectedCompanyId ? (
        <div className='text-gray-600 p-6 bg-white/5 rounded'>
          {isTenantMode ? 'Компания не найдена' : 'Выберите компанию для просмотра продуктов'}
        </div>
      ) : loading ? (
        <div className='p-6 bg-white/5 rounded text-gray-500'>Загрузка...</div>
      ) : products.length === 0 ? (
        <div className='text-gray-600 p-6 bg-white/5 rounded'>
          {globalSearch ? 'Нет продуктов, соответствующих запросу.' : 'Нет продуктов для этой компании.'}
        </div>
      ) : (
        <section className='space-y-4'>
          {!isTenantMode && (
            <div className='flex justify-between items-center mb-3'>
              <div>
                <h2 className='text-lg font-medium'>{selectedCompany?.name || `Компания ${selectedCompanyId}`}</h2>
                <div className='text-sm text-gray-500'>Продуктов: {totalCount}</div>
              </div>
            </div>
          )}

          <TableDefault<Product> columns={columns} data={products} className='bg-transparent' />

          <div className='mt-3'>
            <Pagination currentPage={currentPage} pageSize={pageSize} total={totalCount} onPageChange={handlePageChange} />
          </div>
        </section>
      )}

      <ModalWindowDefault isOpen={isCreateOpen} onClose={closeCreate} showCloseIcon>
        <div>
          <h2 className='text-xl font-semibold mb-4'>Новый продукт</h2>

          <ProductForm fixedCompanyId={selectedCompanyId} onCancel={closeCreate} onSuccess={onCreated} />
        </div>
      </ModalWindowDefault>

      <ModalWindowDefault isOpen={isModalOpen} onClose={closeModal} showCloseIcon>
        <div>
          {isEditing ? (
            <>
              <h2 className='text-xl font-semibold mb-4'>
                {selectedProduct ? 'Редактирование продукта' : 'Загрузка продукта...'}
              </h2>

              {modalLoading && <div className='text-sm text-gray-500'>Загрузка...</div>}

              {modalError && <div className='text-sm text-red-600'>{modalError}</div>}

              {!modalLoading && selectedProduct && (
                <ProductForm
                  product={selectedProduct}
                  fixedCompanyId={selectedCompanyId}
                  onCancel={closeModal}
                  onSuccess={async () => {
                    closeModal();
                    if (selectedCompanyId) {
                      await fetchProducts(selectedCompanyId, currentPage, pageSize, globalSearch);
                    }
                  }}
                />
              )}
            </>
          ) : (
            <>
              <h2 className='text-xl font-semibold mb-4'>Просмотр продукта</h2>

              {modalLoading && <div className='text-sm text-gray-500'>Загрузка...</div>}

              {modalError && <div className='text-sm text-red-600'>{modalError}</div>}

              {!modalLoading && selectedProduct && (
                <div className='space-y-2 text-sm text-gray-800'>
                  <div>
                    <strong>ID:</strong> {selectedProduct.id}
                  </div>
                  <div>
                    <strong>Название:</strong> {selectedProduct.name}
                  </div>
                  <div>
                    <strong>Описание:</strong> {selectedProduct.description}
                  </div>
                  <div>
                    <strong>Цена:</strong> {formatMoney(selectedProduct.price)} {selectedProduct.currency}
                  </div>
                  <div>
                    <strong>Остаток:</strong> {renderStock(selectedProduct.stock_quantity)}
                  </div>
                  <div>
                    <strong>Мин. остаток:</strong> {selectedProduct.min_stock_level}
                  </div>
                  <div>
                    <strong>Ед. изм.:</strong> {selectedProduct.unit}
                  </div>
                  <div>
                    <strong>Себестоимость:</strong> {formatMoney(selectedProduct.cost_price ?? '')}
                  </div>
                  <div>
                    <strong>Вес, кг:</strong> {formatMeasure(selectedProduct.weight ?? '')}
                  </div>
                  <div>
                    <strong>Объем, м³:</strong> {formatMeasure(selectedProduct.volume ?? '')}
                  </div>
                  <div>
                    <strong>Активен:</strong> {selectedProduct.active ? 'Да' : 'Нет'}
                  </div>
                  <div>
                    <strong>Компания:</strong>{' '}
                    {selectedProduct.company
                      ? typeof selectedProduct.company === 'string'
                        ? selectedProduct.company
                        : ((selectedProduct.company as Company).name ?? String((selectedProduct.company as Company).id))
                      : ''}
                  </div>
                  <div>
                    <strong>Создан:</strong> {selectedProduct.created_at ?? ''}
                  </div>
                  <div>
                    <strong>Обновлен:</strong> {selectedProduct.updated_at ?? ''}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </ModalWindowDefault>
    </>
  );
}
