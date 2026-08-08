import React, { useState, useEffect } from 'react';
import { Button } from '../../shared/ui/Button/Button';
import { Modal } from '../../shared/ui/Modal/Modal';
import { Input } from '../../shared/ui/Input/Input';
import { createPromocode, deletePromocode, getPromocodes, updatePromocode } from '../../entities/promocode/api/promocodeApi';
import { PencilIcon, TrashIcon } from '../../shared/svgIcons';
import styles from './admin.module.css';

export const PromocodesPage = () => {
  const [promocodes, setPromocodes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingPromocode, setEditingPromocode] = useState(null);
  const [filterInput, setFilterInput] = useState('');
  const [filter, setFilter] = useState('');
  const [formData, setFormData] = useState({
    code: '',
    discount_percent: '',
    max_discount: '',
    max_usages: '',
    expires_at: '',
    is_active: true
  });

  useEffect(() => {
    fetchPromocodes();
  }, []);

  const fetchPromocodes = async () => {
    try {
      const data = await getPromocodes(filter ? { code: filter } : {});
      setPromocodes(data);
    } catch (error) {
      // console.error('Error fetching promocodes:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPromocodes();
  }, [filter]);

  useEffect(() => {
    const t = setTimeout(() => {
      setFilter(filterInput.trim());
    }, 800);
    return () => clearTimeout(t);
  }, [filterInput]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        code: formData.code || null,
        discount_percent: Number(formData.discount_percent),
        max_discount: formData.max_discount ? Number(formData.max_discount) : null,
        max_usages: formData.max_usages ? Number(formData.max_usages) : null,
        is_active: formData.is_active,
        expires_at: formData.expires_at ? new Date(formData.expires_at).toISOString() : null,
      };
      if (editingPromocode) {
        await updatePromocode({ promocode_id: editingPromocode.id, ...payload });
      } else {
        await createPromocode(payload);
      }
      fetchPromocodes();
      setModalOpen(false);
      resetForm();
    } catch (error) {
      // console.error('Error saving promocode:', error);
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm('Вы уверены, что хотите удалить этот промокод?')) {
      try {
        await deletePromocode(id);
        fetchPromocodes();
      } catch (error) {
        // console.error('Error deleting promocode:', error);
      }
    }
  };

  const resetForm = () => {
    setEditingPromocode(null);
    setFormData({
      code: '',
      discount_percent: '',
      max_discount: '',
      max_usages: '',
      expires_at: '',
      is_active: true
    });
  };

  const openEditModal = (promocode) => {
    setEditingPromocode(promocode);
    setFormData({
      code: promocode.code,
      discount_percent: promocode.discount_percent,
      max_discount: promocode.max_discount || '',
      max_usages: promocode.max_usages || '',
      expires_at: promocode.expires_at?.split('T')[0] || '',
      is_active: promocode.is_active
    });
    setModalOpen(true);
  };

  if (loading) {
    return <div className={styles.loading}>Загрузка...</div>;
  }

  return (
    <div>
      <div className={styles.adminHeader}>
        <h1 className={styles.pageTitle}>Промокоды</h1>
        <Button onClick={() => setModalOpen(true)}>+ Добавить промокод</Button>
      </div>

      <div className={styles.formGroup} style={{ marginBottom: '20px' }}>
        <Input
          placeholder="Поиск по коду..."
          value={filterInput}
          onChange={(e) => setFilterInput(e.target.value)}
        />
      </div>

      <div className={styles.tableContainer}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>ID</th>
              <th>Код</th>
              <th>Тип скидки</th>
              <th>Значение</th>
              <th>Макс. скидка</th>
              <th>Лимит</th>
              <th>Статус</th>
              <th>Действия</th>
            </tr>
          </thead>
          <tbody>
            {promocodes.map((promocode) => (
              <tr key={promocode.id}>
                <td>{promocode.id}</td>
                <td><strong>{promocode.code}</strong></td>
                <td>Процент</td>
                <td>{promocode.discount_percent}%</td>
                <td>{promocode.max_discount || '-'}</td>
                <td>{promocode.max_usages || '∞'}</td>
                <td>
                  <span className={`${styles.badge} ${promocode.is_active ? styles.active : styles.inactive}`}>
                    {promocode.is_active ? 'Активен' : 'Неактивен'}
                  </span>
                </td>
                <td>
                  <div className={styles.actionButtons}>
                    <button
                      type="button"
                      className={`${styles.iconButton} ${styles.iconButtonEdit}`}
                      onClick={() => openEditModal(promocode)}
                      title="Редактировать"
                      aria-label="Редактировать"
                    >
                      <PencilIcon className={styles.adminActionIcon} />
                    </button>
                    <button
                      type="button"
                      className={`${styles.iconButton} ${styles.iconButtonDelete}`}
                      onClick={() => handleDelete(promocode.id)}
                      title="Удалить"
                      aria-label="Удалить"
                    >
                      <TrashIcon className={styles.adminActionIcon} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal isOpen={modalOpen} onClose={() => { setModalOpen(false); resetForm(); }} title={editingPromocode ? 'Редактировать промокод' : 'Добавить промокод'}>
        <form onSubmit={handleSubmit} className={styles.form}>
          <Input
            label="Код промокода"
            value={formData.code}
            onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
            required
          />
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Скидка в процентах</label>
          </div>
          <Input
            label="Скидка (%)"
            type="number"
            value={formData.discount_percent}
            onChange={(e) => setFormData({ ...formData, discount_percent: e.target.value })}
            required
          />
          <Input
            label="Максимальная скидка (необязательно)"
            type="number"
            value={formData.max_discount}
            onChange={(e) => setFormData({ ...formData, max_discount: e.target.value })}
          />
          <Input
            label="Действителен до"
            type="date"
            value={formData.expires_at}
            onChange={(e) => setFormData({ ...formData, expires_at: e.target.value })}
          />
          <Input
            label="Лимит использований"
            type="number"
            placeholder="Оставьте пустым для безлимита"
            value={formData.max_usages}
            onChange={(e) => setFormData({ ...formData, max_usages: e.target.value })}
          />
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>
              <input
                type="checkbox"
                checked={formData.is_active}
                onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
              />
              {' '}Активен
            </label>
          </div>
          <div className={styles.formActions}>
            <Button type="button" variant="secondary" onClick={() => { setModalOpen(false); resetForm(); }}>Отмена</Button>
            <Button type="submit">Сохранить</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};