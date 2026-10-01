import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { useApp } from '../context/AppContext';
import EventForm from './EventForm';
import EventResult from './EventResult';
import { Modal } from './ui';

export default function AddEventModal() {
  const { modal, closeEventModal, version } = useApp();
  const [customers, setCustomers] = useState([]);
  const [result, setResult] = useState(null);
  const [formKey, setFormKey] = useState(0);

  useEffect(() => {
    if (!modal.open) return;
    api.customers({ sort: 'name' }).then((d) => setCustomers(d.customers)).catch(() => setCustomers([]));
  }, [modal.open, version]);

  useEffect(() => { if (modal.open) { setResult(null); setFormKey((k) => k + 1); } }, [modal.open]);

  const fixed = modal.customerId;
  const name = fixed && customers.find((c) => c._id === fixed)?.name;

  return (
    <Modal
      open={modal.open}
      onClose={closeEventModal}
      title={result ? 'Event processed' : 'Add customer event'}
      sub={result ? 'Saved, replayed through the rule engine and pushed to every open view.' : `Simulate an event arriving from a source system${name ? ` for ${name}` : ''}.`}
      footer={result ? (
        <div className="flex justify-end gap-2">
          <button className="btn-secondary" onClick={() => { setResult(null); setFormKey((k) => k + 1); }}>Add another event</button>
          <button className="btn-primary" onClick={closeEventModal}>Done</button>
        </div>
      ) : null}
    >
      {result
        ? <EventResult result={result} showCustomerLink={!fixed} />
        : <EventForm key={formKey} customers={customers} customerId={fixed || undefined} initialPreset={modal.preset} onResult={setResult} onCancel={closeEventModal} />}
    </Modal>
  );
}
