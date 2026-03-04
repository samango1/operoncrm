'use client';

import React, { useEffect, useState } from 'react';
import { getUsers, getUserById } from '@/lib/api';
import { formatPhoneDisplay } from '@/lib/phone';
import type { User } from '@/types/api/users';
import Pagination from '@/components/Layouts/Pagination';
import TableDefault, { Column } from '@/components/Tables/TableDefault';
import ModalWindowDefault from '@/components/ModalWindows/ModalWindowDefault';
import ButtonDefault from '@/components/Buttons/ButtonDefault';
import SearchInput from '@/components/Inputs/SearchInput';
import UserForm from '@/components/Forms/UserForm';
import { Pencil, Eye } from 'lucide-react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { t } from '@/i18n';
export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [count, setCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(10);
  const [search, setSearch] = useState<string>('');
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalLoading, setModalLoading] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  useEffect(() => {
    const s = searchParams?.get('search') ?? '';
    const p = parseInt(searchParams?.get('page') ?? '', 10) || 1;
    const ps = parseInt(searchParams?.get('page_size') ?? '', 10) || 10;
    setSearch(s);
    setCurrentPage(p);
    setPageSize(ps);
  }, [searchParams?.toString()]);
  const fetchUsers = async (page = currentPage, ps = pageSize, q = search) => {
    setLoading(true);
    setError(null);
    try {
      const res = await getUsers({
        page,
        page_size: ps,
        search: q,
      });
      setUsers(res.results);
      setCount(res.count);
    } catch (err) {
      console.error('getUsers error:', err);
      setError(t('ui.failed_to_load_users'));
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    fetchUsers();
  }, [currentPage, pageSize, search]);
  const openViewModal = async (userId: string) => {
    setIsModalOpen(true);
    setModalLoading(true);
    setModalError(null);
    setSelectedUser(null);
    setIsEditing(false);
    try {
      const user = await getUserById(userId, {
        deep: true,
      });
      setSelectedUser(user);
    } catch (err) {
      console.error('getUserById error:', err);
      setModalError(t('ui.failed_to_load_user'));
    } finally {
      setModalLoading(false);
    }
  };
  const openEditModal = async (userId: string) => {
    setIsModalOpen(true);
    setModalLoading(true);
    setModalError(null);
    setSelectedUser(null);
    setIsEditing(true);
    try {
      const user = await getUserById(userId, {
        deep: true,
      });
      setSelectedUser(user);
    } catch (err) {
      console.error('getUserById error:', err);
      setModalError(t('ui.failed_to_load_user'));
    } finally {
      setModalLoading(false);
    }
  };
  const openCreateModal = () => {
    setSelectedUser(null);
    setIsEditing(true);
    setModalError(null);
    setIsModalOpen(true);
  };
  const closeModal = () => {
    setIsModalOpen(false);
    setSelectedUser(null);
    setModalError(null);
    setIsEditing(false);
  };
  const columns: Column<User>[] = [
    {
      key: 'name',
      label: t('ui.name'),
    },
    {
      key: 'phone',
      label: t('ui.phone'),
      render: (row) => formatPhoneDisplay(String(row.phone ?? '')),
    },
    {
      key: 'platform_role',
      label: t('ui.role'),
    },
    {
      key: 'actions',
      label: t('ui.actions'),
      render: (row: User) => (
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
      setCurrentPage(page);
      updateUrl({
        page,
        page_size: newPageSize,
        search,
      });
      return;
    }
    setCurrentPage(page);
    updateUrl({
      page,
      page_size: pageSize,
      search,
    });
  };
  const updateUrl = (opts: { page?: number; page_size?: number; search?: string }) => {
    try {
      const params = new URLSearchParams(window.location.search);
      if (opts.search && opts.search.length > 0) {
        params.set('search', opts.search);
      } else {
        params.delete('search');
      }
      if (opts.page && opts.page > 1) {
        params.set('page', String(opts.page));
      } else {
        params.delete('page');
      }
      if (opts.page_size) {
        params.set('page_size', String(opts.page_size));
      } else {
        params.delete('page_size');
      }
      const qs = params.toString();
      router.push(qs ? `${pathname}?${qs}` : `${pathname}`);
    } catch (e) {
      console.warn('updateUrl failed', e);
    }
  };
  const handleSearch = (q: string) => {
    setSearch(q);
    setCurrentPage(1);
    updateUrl({
      page: 1,
      page_size: pageSize,
      search: q,
    });
  };
  return (
    <>
      <section className='mb-6 flex justify-between'>
        <div>
          <h1 className='text-2xl font-semibold'>{t('ui.users')}</h1>
          <p className='text-sm text-gray-500'>
            {t('ui.total')} {count}
          </p>
        </div>
        <div className='content-center'>
          <ButtonDefault onClick={openCreateModal} variant='positive'>
            {t('ui.add')}
          </ButtonDefault>
        </div>
      </section>

      <div className='mb-4 flex items-center justify-between gap-4'>
        <SearchInput initialValue={search} onSearch={handleSearch} placeholder={t('ui.search_by_name_phone_role')} />
      </div>

      {error && <p className='text-red-600 mb-4'>{error}</p>}

      <div className='mb-4'>
        {loading ? (
          <div className='p-6 bg-white/5 rounded text-gray-500'>{t('ui.loading')}</div>
        ) : (
          <TableDefault<User> columns={columns} data={users} className='bg-transparent' />
        )}
      </div>

      <Pagination currentPage={currentPage} pageSize={pageSize} total={count} onPageChange={handlePageChange} />

      <ModalWindowDefault isOpen={isModalOpen} onClose={closeModal} showCloseIcon>
        <div>
          {isEditing ? (
            <>
              <h2 className='text-xl font-semibold mb-4'>{selectedUser ? t('ui.editing_a_user') : t('ui.new_user')}</h2>

              {modalLoading && <div className='text-sm text-gray-500'>{t('ui.loading')}</div>}

              {modalError && <div className='text-sm text-red-600'>{modalError}</div>}

              {!modalLoading && (
                <UserForm
                  user={selectedUser}
                  onCancel={closeModal}
                  onSuccess={async (_u) => {
                    closeModal();
                    await fetchUsers(currentPage, pageSize, search);
                  }}
                />
              )}
            </>
          ) : (
            <>
              <h2 className='text-xl font-semibold mb-4'>{t('ui.view_user')}</h2>

              {modalLoading && <div className='text-sm text-gray-500'>{t('ui.loading')}</div>}

              {modalError && <div className='text-sm text-red-600'>{modalError}</div>}

              {!modalLoading &&
                selectedUser &&
                (() => {
                  const userFields = [
                    {
                      label: 'ID',
                      value: selectedUser.id,
                    },
                    {
                      label: t('ui.full_name'),
                      value: selectedUser.name,
                    },
                    {
                      label: t('ui.phone_number'),
                      value: selectedUser.phone,
                    },
                    {
                      label: t('ui.role_of_the_platform'),
                      value: selectedUser.platform_role,
                    },
                  ];
                  const createdByFields = [
                    {
                      label: 'ID',
                      value: selectedUser.created_by?.id,
                    },
                    {
                      label: t('ui.full_name'),
                      value: selectedUser.created_by?.name,
                    },
                    {
                      label: t('ui.phone_number'),
                      value: selectedUser.created_by?.phone,
                    },
                    {
                      label: t('ui.role_of_the_platform'),
                      value: selectedUser.created_by?.platform_role,
                    },
                  ];
                  return (
                    <div className='space-y-2 text-sm text-gray-800'>
                      {userFields.map((field) => (
                        <div key={field.label}>
                          <strong>{field.label}:</strong> {String(field.value ?? '')}
                        </div>
                      ))}

                      <div className='bg-gray-200 rounded p-4'>
                        <pre>
                          <div>{t('ui.created_by')}</div>
                          {createdByFields.map((field) => (
                            <div key={field.label}>
                              <strong>{field.label}:</strong> {String(field.value ?? '')}
                            </div>
                          ))}
                        </pre>
                      </div>
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
