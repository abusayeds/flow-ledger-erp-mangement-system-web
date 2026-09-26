/**
 * Form Builder create/edit — POST create | PATCH + PUT fields
 */
import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { showToast } from "@/utils/toast";
import {
  createForm,
  fetchForm,
  updateForm,
  updateFormFields,
  formShareUrl,
} from "@/services/formBuilderApi";
import { selectCls, inputCls } from "../hrm/hrmShared";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  Settings,
  Plus,
  Eye,
  Type,
  Mail,
  Hash,
  Phone,
  Link2,
  Lock,
  FileText,
  List,
  Radio,
  CheckSquare,
  Calendar,
  Clock,
  ArrowUp,
  ArrowDown,
  Trash2,
  GripVertical,
  Copy,
} from "lucide-react";

interface FieldType {
  type: string;
  label: string;
  icon: React.ElementType;
  defaultLabel: string;
  placeholder: string;
}

const FIELD_TYPES: FieldType[] = [
  { type: "text", label: "Text Input", icon: Type, defaultLabel: "Text Field", placeholder: "Enter text" },
  { type: "email", label: "Email", icon: Mail, defaultLabel: "Email Field", placeholder: "Enter email" },
  { type: "number", label: "Number", icon: Hash, defaultLabel: "Number Field", placeholder: "Enter number" },
  { type: "phone", label: "Phone", icon: Phone, defaultLabel: "Phone Field", placeholder: "Enter phone" },
  { type: "url", label: "URL", icon: Link2, defaultLabel: "URL Field", placeholder: "Enter URL" },
  { type: "password", label: "Password", icon: Lock, defaultLabel: "Password Field", placeholder: "Enter password" },
  { type: "textarea", label: "Textarea", icon: FileText, defaultLabel: "Textarea Field", placeholder: "Enter text" },
  { type: "select", label: "Select Dropdown", icon: List, defaultLabel: "Select Field", placeholder: "Select option" },
  { type: "radio", label: "Radio Buttons", icon: Radio, defaultLabel: "Radio Field", placeholder: "" },
  { type: "checkbox", label: "Checkbox", icon: CheckSquare, defaultLabel: "Checkbox Field", placeholder: "" },
  { type: "date", label: "Date", icon: Calendar, defaultLabel: "Date Field", placeholder: "" },
  { type: "time", label: "Time", icon: Clock, defaultLabel: "Time Field", placeholder: "" },
];

const META = Object.fromEntries(FIELD_TYPES.map((f) => [f.type, f]));
const toBackendType = (t: string) => (t === "phone" ? "tel" : t);
const fromBackendType = (t: string) => (t === "tel" ? "phone" : t);
const needsOptions = (t: string) => ["select", "radio", "checkbox"].includes(t);

interface Field {
  id: string;
  type: string;
  label: string;
  placeholder: string;
  required: boolean;
  optionsText: string;
  backendId?: string;
}

const Toggle: React.FC<{ on: boolean; onClick: () => void }> = ({ on, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className={`w-11 h-6 rounded-full p-0.5 transition-colors flex-shrink-0 ${on ? "bg-emerald-500" : "bg-gray-300"}`}
  >
    <span className={`block w-5 h-5 bg-white rounded-full shadow transition-transform ${on ? "translate-x-5" : ""}`} />
  </button>
);

const SortableFieldCard: React.FC<{
  field: Field;
  index: number;
  count: number;
  selected: boolean;
  onSelect: (id: string) => void;
  onMove: (id: string, dir: -1 | 1) => void;
  onRemove: (id: string) => void;
  onUpdate: (id: string, patch: Partial<Field>) => void;
}> = ({ field: f, index: i, count, selected, onSelect, onMove, onRemove, onUpdate }) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: f.id });
  const m = META[f.type] || META.text;
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
    zIndex: isDragging ? 20 : undefined,
  };
  return (
    <div
      ref={setNodeRef}
      style={style}
      onClick={() => onSelect(f.id)}
      className={`rounded-xl border p-5 cursor-pointer transition-colors bg-white ${
        selected ? "border-emerald-400 ring-1 ring-emerald-400" : "border-gray-200 hover:border-gray-300"
      }`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            type="button"
            {...attributes}
            {...listeners}
            onClick={(e) => e.stopPropagation()}
            className="w-6 h-9 flex items-center justify-center text-gray-300 hover:text-gray-500 cursor-grab active:cursor-grabbing touch-none"
          >
            <GripVertical className="w-4 h-4" />
          </button>
          <span className="w-9 h-9 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <m.icon className="w-4 h-4" />
          </span>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-gray-900">Field {i + 1}</span>
              {f.required && (
                <span className="px-2 py-0.5 rounded-full bg-red-500 text-white text-[10px] font-semibold">
                  Required
                </span>
              )}
            </div>
            <div className="text-xs text-gray-500 mt-0.5">{m.label}</div>
          </div>
        </div>
        {selected && (
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onMove(f.id, -1);
              }}
              disabled={i === 0}
              className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-gray-100 text-gray-500 disabled:opacity-30"
            >
              <ArrowUp className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onMove(f.id, 1);
              }}
              disabled={i === count - 1}
              className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-gray-100 text-gray-500 disabled:opacity-30"
            >
              <ArrowDown className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onRemove(f.id);
              }}
              className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-red-50 text-red-500"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[1fr_1fr_auto] gap-4 items-end mt-4">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Field Label</label>
          <input
            value={f.label}
            onClick={(e) => e.stopPropagation()}
            onChange={(e) => onUpdate(f.id, { label: e.target.value })}
            className={inputCls}
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Placeholder Text</label>
          <input
            value={f.placeholder}
            onClick={(e) => e.stopPropagation()}
            onChange={(e) => onUpdate(f.id, { placeholder: e.target.value })}
            className={inputCls}
          />
        </div>
        <div className="flex items-center gap-2 pb-2">
          <span className="text-sm text-gray-600">Required</span>
          <Toggle on={f.required} onClick={() => onUpdate(f.id, { required: !f.required })} />
        </div>
      </div>

      {needsOptions(f.type) && (
        <div className="mt-4" onClick={(e) => e.stopPropagation()}>
          <label className="block text-xs font-medium text-gray-600 mb-1">
            Options <span className="text-gray-400">(comma-separated)</span>
          </label>
          <input
            value={f.optionsText}
            onChange={(e) => onUpdate(f.id, { optionsText: e.target.value })}
            placeholder="Option A, Option B, Option C"
            className={inputCls}
          />
        </div>
      )}
    </div>
  );
};

const FormBuilder: React.FC = () => {
  const navigate = useNavigate();
  const { id: editId } = useParams();
  const isEdit = Boolean(editId);

  const [formName, setFormName] = useState("");
  const [enabled, setEnabled] = useState(true);
  const [layout, setLayout] = useState("single");
  const [fields, setFields] = useState<Field[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(isEdit);
  const [shareCode, setShareCode] = useState("");

  useEffect(() => {
    if (!editId) return;
    let cancelled = false;
    setLoading(true);
    void fetchForm(editId)
      .then((form) => {
        if (cancelled) return;
        setFormName(form.name);
        setEnabled(form.isActive);
        setLayout(form.defaultLayout === "two-column" ? "two-column" : "single");
        setShareCode(form.code);
        const mapped = form.fields
          .slice()
          .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
          .map((f, i) => ({
            id: f._id || `tmp-${i}`,
            backendId: f._id,
            type: fromBackendType(f.type),
            label: f.label,
            placeholder: f.placeholder || "",
            required: Boolean(f.required),
            optionsText: (f.options || []).join(", "),
          }));
        setFields(mapped);
      })
      .catch((e: any) => {
        showToast(e?.message || "Failed to load form", "error");
        navigate("/form-builder");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [editId, navigate]);

  const requiredCount = fields.filter((f) => f.required).length;
  const typeCount = (type: string) => fields.filter((f) => f.type === type).length;

  const addField = (type: string) => {
    const m = META[type];
    const id = `new-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    setFields((f) => [
      ...f,
      {
        id,
        type,
        label: m.defaultLabel,
        placeholder: m.placeholder,
        required: false,
        optionsText: needsOptions(type) ? "Option 1, Option 2" : "",
      },
    ]);
    setSelectedId(id);
  };

  const update = (id: string, patch: Partial<Field>) =>
    setFields((f) => f.map((x) => (x.id === id ? { ...x, ...patch } : x)));
  const remove = (id: string) => {
    setFields((f) => f.filter((x) => x.id !== id));
    if (selectedId === id) setSelectedId(null);
  };
  const move = (id: string, dir: -1 | 1) =>
    setFields((f) => {
      const i = f.findIndex((x) => x.id === id);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= f.length) return f;
      const copy = [...f];
      [copy[i], copy[j]] = [copy[j], copy[i]];
      return copy;
    });

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));
  const onDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (over && active.id !== over.id) {
      setFields((f) => {
        const oldI = f.findIndex((x) => x.id === active.id);
        const newI = f.findIndex((x) => x.id === over.id);
        return oldI < 0 || newI < 0 ? f : arrayMove(f, oldI, newI);
      });
    }
  };

  const toPayloadFields = () =>
    fields.map((f, i) => ({
      ...(f.backendId ? { _id: f.backendId } : {}),
      label: f.label.trim() || META[f.type]?.defaultLabel || "Field",
      type: toBackendType(f.type),
      required: f.required,
      placeholder: f.placeholder,
      options: needsOptions(f.type)
        ? f.optionsText
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean)
        : [],
      order: i,
    }));

  const handleSave = async () => {
    if (!formName.trim()) {
      showToast("Please enter a form name", "info");
      return;
    }
    if (fields.length === 0) {
      showToast("Add at least one field to the form", "info");
      return;
    }
    for (const f of fields) {
      if (needsOptions(f.type)) {
        const opts = f.optionsText
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean);
        if (opts.length === 0) {
          showToast(`Add options for "${f.label || f.type}"`, "error");
          return;
        }
      }
    }

    setSaving(true);
    try {
      const fieldPayload = toPayloadFields();
      if (isEdit && editId) {
        await updateForm(editId, {
          name: formName.trim(),
          is_active: enabled,
          default_layout: layout,
        });
        await updateFormFields(editId, fieldPayload);
        showToast("Form updated", "success");
        navigate(`/form-builder/${editId}/responses`);
      } else {
        const created: any = await createForm({
          name: formName.trim(),
          is_active: enabled,
          default_layout: layout,
          fields: fieldPayload,
        });
        const newId = created?._id || created?.data?._id || created?.id;
        showToast("Form saved successfully", "success");
        if (newId) navigate(`/form-builder/${newId}/responses`);
        else navigate("/form-builder");
      }
    } catch (e: any) {
      showToast(e?.message || "Could not save the form", "error");
    } finally {
      setSaving(false);
    }
  };

  const copyLink = async () => {
    if (!shareCode) return;
    try {
      await navigator.clipboard.writeText(formShareUrl(shareCode));
      showToast("Share link copied", "success");
    } catch {
      showToast("Could not copy link", "error");
    }
  };

  if (loading) {
    return <div className="module-page-shell p-6 text-gray-500">Loading form…</div>;
  }

  return (
    <div className="module-page-shell h-full overflow-y-auto custom-scrollbar">
      <div className="module-title-bar sticky top-0 z-10 h-auto py-4">
        <div>
          <div className="text-xs text-gray-400">
            Dashboard <span className="mx-1">›</span> Form Builder <span className="mx-1">›</span>{" "}
            <span className="text-gray-700 font-medium">{isEdit ? "Edit" : "Create"}</span>
          </div>
          <h1 className="text-xl font-bold text-gray-900 mt-0.5">
            {isEdit ? "Edit Form" : "Form Builder"}
          </h1>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {shareCode && (
            <button
              type="button"
              onClick={() => void copyLink()}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-sm border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
            >
              <Copy className="w-4 h-4" /> Copy link
            </button>
          )}
          <button
            type="button"
            onClick={() => navigate("/form-builder")}
            className="px-5 py-2 text-sm border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={saving}
            className="px-6 py-2 text-sm bg-emerald-600 text-white rounded-md hover:bg-emerald-700 font-medium disabled:opacity-60"
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>

      <div className="px-6 py-6 grid grid-cols-1 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] gap-6 items-start">
        <div className="space-y-6">
          <div className="bg-white border border-gray-200 rounded-xl p-6">
            <div className="flex items-center gap-2 mb-5">
              <Settings className="w-5 h-5 text-gray-700" />
              <h2 className="text-lg font-bold text-gray-900">Form Configuration</h2>
            </div>

            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Form Name <span className="text-red-500">*</span>
            </label>
            <input
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              placeholder="Enter form name"
              className={`${inputCls} mb-5`}
            />

            <div className="flex items-center justify-between mb-5">
              <span className="text-sm font-medium text-gray-700">Enable Form</span>
              <Toggle on={enabled} onClick={() => setEnabled((v) => !v)} />
            </div>

            <label className="block text-sm font-medium text-gray-700 mb-1.5">Default Layout</label>
            <select
              value={layout}
              onChange={(e) => setLayout(e.target.value)}
              className={selectCls}
            >
              <option value="single">Single Column</option>
              <option value="two-column">Two Columns</option>
            </select>

            <div className="mt-5 pt-5 border-t border-gray-200">
              <h3 className="text-sm font-semibold text-gray-900 mb-3">Form Statistics</h3>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg bg-blue-50 border border-blue-100 px-4 py-3">
                  <div className="text-xl font-bold text-blue-700">{fields.length}</div>
                  <div className="text-xs text-blue-600">Fields</div>
                </div>
                <div className="rounded-lg bg-green-50 border border-green-100 px-4 py-3">
                  <div className="text-xl font-bold text-green-700">{requiredCount}</div>
                  <div className="text-xs text-green-600">Required</div>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-xl p-6">
            <div className="flex items-center gap-2 mb-5">
              <Plus className="w-5 h-5 text-gray-700" />
              <h2 className="text-lg font-bold text-gray-900">Available Field Types</h2>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {FIELD_TYPES.map((ft) => {
                const count = typeCount(ft.type);
                return (
                  <button
                    key={ft.type}
                    type="button"
                    onClick={() => addField(ft.type)}
                    className="relative flex flex-col items-center justify-center gap-2 py-4 border border-gray-200 rounded-lg hover:border-emerald-400 hover:bg-emerald-50/40 transition-colors"
                  >
                    {count > 0 && (
                      <span className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-emerald-500 text-white text-[11px] font-semibold flex items-center justify-center">
                        {count}
                      </span>
                    )}
                    <ft.icon className="w-5 h-5 text-gray-500" />
                    <span className="text-xs font-medium text-gray-700 text-center">{ft.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2">
              <Eye className="w-5 h-5 text-gray-700" />
              <h2 className="text-lg font-bold text-gray-900">Form Preview</h2>
            </div>
            <span className="px-3 py-1 rounded-full bg-gray-100 text-xs font-medium text-gray-600">
              {fields.length} fields
            </span>
          </div>

          {fields.length === 0 ? (
            <div className="border-2 border-dashed border-gray-300 rounded-xl py-16 flex flex-col items-center justify-center text-center px-6">
              <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center">
                <Plus className="w-7 h-7 text-gray-400" />
              </div>
              <h3 className="mt-5 text-lg font-bold text-gray-900">Start Building Your Form</h3>
              <p className="mt-1.5 text-sm text-gray-500">
                Click on any field type from the sidebar to add it to your form
              </p>
            </div>
          ) : (
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
              <SortableContext items={fields.map((f) => f.id)} strategy={verticalListSortingStrategy}>
                <div className="space-y-4">
                  {fields.map((f, i) => (
                    <SortableFieldCard
                      key={f.id}
                      field={f}
                      index={i}
                      count={fields.length}
                      selected={selectedId === f.id}
                      onSelect={setSelectedId}
                      onMove={move}
                      onRemove={remove}
                      onUpdate={update}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          )}
        </div>
      </div>
    </div>
  );
};

export default FormBuilder;
