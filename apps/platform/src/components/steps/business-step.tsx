"use client";

import {
  applyCategory,
  type BusinessStep as BusinessValues,
  businessStepSchema,
} from "@brotasites/schema";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useEffect, useId, useState } from "react";
import { useForm } from "react-hook-form";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { StepFooter } from "@/components/wizard/step-footer";
import { StepHeader } from "@/components/wizard/step-header";
import { readDemoHandoff } from "@/lib/demo-handoff";
import { useDraft } from "@/lib/draft-store";
import { CategoryPicker, listedCategories, OTHER, pickerValueFor } from "./category-picker";

export function BusinessStep() {
  const router = useRouter();
  const { draft, updateDraft, completeStep } = useDraft();
  const storedCategory = draft.business?.category;
  const [choice, setChoice] = useState(() => pickerValueFor(storedCategory));
  const categoryHelpId = useId();
  const categoryErrorId = useId();

  const form = useForm<BusinessValues>({
    resolver: zodResolver(businessStepSchema),
    mode: "onTouched",
    defaultValues: {
      name: draft.business?.name ?? "",
      category: storedCategory ?? "",
      city: draft.business?.contact?.address?.city ?? "",
    },
  });

  // Every keystroke goes to the draft, so the preview follows along.
  useEffect(() => {
    const { unsubscribe } = form.watch((values, { name }) => {
      if (name === "name") {
        updateDraft((d) => ({ ...d, business: { ...d.business, name: values.name } }));
      }
      if (name === "city") {
        updateDraft((d) => ({
          ...d,
          business: {
            ...d.business,
            contact: {
              ...d.business?.contact,
              address: { ...d.business?.contact?.address, city: values.city },
            },
          },
        }));
      }
      if (name === "category" && values.category !== undefined) {
        const category = values.category;
        updateDraft((d) => applyCategory(d, category));
      }
    });
    return unsubscribe;
  }, [form, updateDraft]);

  // Answers brought from the home page demo (/criar/negocio?nome=...&tipo=...): applied once,
  // then removed from the address. Other answers in the draft stay as they are.
  // biome-ignore lint/correctness/useExhaustiveDependencies: runs once, on arrival
  useEffect(() => {
    const { name, type } = readDemoHandoff(
      window.location.search,
      listedCategories.map((c) => c.id),
    );
    if (name) form.setValue("name", name, { shouldDirty: true });
    if (type) chooseCategory(type);
    if (window.location.search) window.history.replaceState(null, "", window.location.pathname);
  }, []);

  function chooseCategory(id: string) {
    setChoice(id);
    const label = listedCategories.find((c) => c.id === id)?.label ?? "";
    form.setValue("category", label, {
      shouldDirty: true,
      shouldTouch: true,
      shouldValidate: label !== "",
    });
  }

  function onSubmit() {
    completeStep("negocio");
    router.push("/criar/modelo");
  }

  const categoryError = form.formState.errors.category?.message;

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="flex flex-1 flex-col">
        <StepHeader step="negocio" />

        <div className="grid gap-7">
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-[0.9375rem] font-semibold">Nome do negócio</FormLabel>
                <FormControl>
                  <Input placeholder="Ex.: Padaria do Zé" autoComplete="organization" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <fieldset className="grid gap-2.5">
            <legend className="mb-2.5 text-[0.9375rem] font-semibold">Tipo de negócio</legend>
            <CategoryPicker
              value={choice}
              onChange={chooseCategory}
              invalid={Boolean(categoryError)}
              describedBy={categoryError ? categoryErrorId : categoryHelpId}
            />
            {choice === OTHER && (
              <FormField
                control={form.control}
                name="category"
                render={({ field }) => (
                  <Input
                    aria-label="Qual é o tipo do negócio?"
                    placeholder="Qual é o tipo? Ex.: Floricultura"
                    className="mt-1"
                    autoFocus
                    {...field}
                  />
                )}
              />
            )}
            {categoryError ? (
              <p id={categoryErrorId} className="text-sm text-destructive">
                {categoryError}
              </p>
            ) : (
              <p id={categoryHelpId} className="text-sm text-ink-soft">
                Com isso sugerimos modelo, cores e seções. Você pode mudar tudo depois.
              </p>
            )}
          </fieldset>

          <FormField
            control={form.control}
            name="city"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-[0.9375rem] font-semibold">Cidade</FormLabel>
                <FormControl>
                  <Input
                    placeholder="Ex.: Santa Rita do Sapucaí"
                    autoComplete="address-level2"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <StepFooter step="negocio" />
      </form>
    </Form>
  );
}
