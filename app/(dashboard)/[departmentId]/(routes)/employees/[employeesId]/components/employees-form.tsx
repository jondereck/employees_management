"use client";
import * as z from "zod";
import { mutate as globalMutate } from "swr";
import { Eligibility, Employee, EmployeeType, Gender, Image, Offices } from "@prisma/client";
import { CalendarIcon, Check, ChevronDown, Trash } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { Button } from "@/components/ui/button";
import Heading from "@/components/ui/heading";
import { Separator } from "@/components/ui/separator";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from "@/components/ui/command";
import axios from "axios";
import { useRouter, useParams } from "next/navigation";
import { AlertModal } from "@/components/modals/alert-modal";
import ImageUpload from "@/components/ui/image-upload";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { Checkbox } from "@/components/ui/checkbox";
import eachDayOfInterval from "date-fns/eachDayOfInterval/index";
import { capitalizeWordsIgnoreSpecialChars, formatToProperCase, formatToUpperCase } from "@/utils/utils";

import { SalaryInput } from "../../components/salary-input";
import { StepIndicator } from "../../components/step-indicator";
import { employeesKey, useEmployee } from "@/hooks/use-employees";
import { AutoField } from "../../components/autofill";
import { formatPHPretty, normalizePHMobileLive } from "@/utils/phone-number";
import AddTimelineEvent from "@/app/(public)/components/admin/add-timeline-event";
import AddAward from "@/app/(public)/components/admin/add-award";
import Timeline from "@/app/(public)/components/timeline";
import AwardsGallery from "@/app/(public)/components/awards-gallery";
import type { ScheduleExceptionDTO, WorkScheduleDTO } from "@/lib/schedules";
import type { WeeklyExclusionDTO } from "@/lib/weeklyExclusions";
import { EmployeeScheduleManager } from "./employee-schedule-manager";



const PREFIX_OPTIONS = [
  "HON.", "ENGR.", "DR.", "ATTY.", "ARCH.", "PROF.", "DIR.", "SIR", "MA'AM"
];

const SUFFIX_OPTIONS = [
  "JR.", "SR.", "II", "III", "IV", "V",
  "CPA", "LPT", "RN", "RCRIM", "MIT"
];


type BioSuggestion = { indexCode: string; candidate: string };


const formSchema = z.object({
  step: z.number().optional(),
  prefix: z.string(),
  employeeNo: z.string(),
  lastName: z.string().min(1, {
    message: "Last Name is required"
  }),

  firstName: z.string().min(1, {
    message: "First Name is required"
  }),
  middleName: z.string(),
  gender: z.string().min(1, {
    message: "Gender is required"
  }),
  employeeTypeId: z.string().min(1, {
    message: "Appointment  is required"
  }),
  officeId: z.string().min(1, {
    message: "Office is required"
  }),
  eligibilityId: z.string().min(1, {
    message: "Eligibility is required."
  }),

  suffix: z.string(),
  images: z.object({ url: z.string() }).array(),
  contactNumber: z.string(),
  position: z
    .string()
    .min(1, {
      message: "Position is required",
    }),
  education: z.string(),
  region: z.string(),
  province: z.string(),
  city: z.string(),
  barangay: z.string(),
  houseNo: z.string(),
  street: z.string(),
  salaryGrade: z
    .union([z.string(), z.number()])
    .transform((v) => String(v).trim())
    .refine((v) => /^\d+$/.test(v), "Salary Grade must be numeric")
    .refine((v) => Number(v) >= 1 && Number(v) <= 33, "Salary Grade must be between 1 and 33")  
    .default("1"),
  salaryStep: z.number().optional().default(1),
  salary: z.number().min(0),
  birthday: z.date().optional(),
  salaryMode: z.enum(["AUTO", "MANUAL"]).default("AUTO"),
  // age: z.string(),
  gsisNo: z.string(),
  pagIbigNo: z.string(),
  tinNo: z.string(),
  philHealthNo: z.string(),
  dateHired: z.union([z.date(), z.string()]).optional(),
  latestAppointment: z.union([z.date(), z.string()]).optional(),
  terminateDate: z.string(),
  isFeatured: z.boolean(),
  isArchived: z.boolean(),
  isHead: z.boolean(),
  memberPolicyNo: z.string(),
  age: z.string(),
  nickname: z.string(),
  emergencyContactName: z.string(),
  emergencyContactNumber: z.string(),
  employeeLink: z.string(),
  designationId: z.string().optional().nullable(), // dropdown can be empty
  note: z.string().optional().nullable(),
})
  .superRefine((data, ctx) => {
    // Require birthday
    if (!data.birthday) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["birthday"],
        message: "Date of birth is required",
      });
    }

    // Require dateHired (accepts Date or non-empty string)
    const hired = data.dateHired;
    if (
      !hired ||
      (typeof hired === "string" && hired.trim() === "")
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["dateHired"],
        message: "Date hired is required",
      });
    }
  });

type EmployeesFormValues = z.infer<typeof formSchema>;
const upper = (s?: string | null) => (s ?? "").toUpperCase();
const EMPTY_DEFAULTS: EmployeesFormValues = {
  step: undefined,
  prefix: "",
  employeeNo: "",
  lastName: "",
  firstName: "",
  middleName: "",
  gender: "",
  employeeTypeId: "",
  officeId: "",
  eligibilityId: "",
  suffix: "",
  images: [],
  contactNumber: "",
  position: "",
  education: "",
  region: "",
  province: "",
  city: "",
  barangay: "",
  houseNo: "",
  street: "",
  salaryGrade: "1",
  salaryStep: 1,
  salary: 0,
  salaryMode: "AUTO",
  birthday: undefined,
  gsisNo: "",
  pagIbigNo: "",
  tinNo: "",
  philHealthNo: "",
  dateHired: undefined,
  latestAppointment: undefined,
  terminateDate: "",
  isFeatured: false,
  isArchived: false,
  isHead: false,
  memberPolicyNo: "",
  age: "",
  nickname: "",
  emergencyContactName: "",
  emergencyContactNumber: "",
  employeeLink: "",
  designationId: null,
  note: "",
};

function mapToDefaults(src: any): EmployeesFormValues {
  if (!src) return EMPTY_DEFAULTS;
  return {
    ...EMPTY_DEFAULTS,

    // ids
    employeeTypeId: src.employeeTypeId ?? "",
    officeId: src.officeId ?? "",
    eligibilityId: src.eligibilityId ?? "",

    // names & address
    firstName: upper(src.firstName),
    middleName: upper(src.middleName),
    lastName: upper(src.lastName),
    prefix: src.prefix ?? "",
    suffix: src.suffix ?? "",
    region: upper(src.region),
    province: upper(src.province),
    city: upper(src.city),
    barangay: upper(src.barangay),
    street: upper(src.street),
    houseNo: src.houseNo ?? "",

    // others
    employeeNo: src.employeeNo ?? "",
    gender: src.gender ?? "",
    contactNumber: src.contactNumber ?? "",
    position: src.position ?? "",
    education: src.education ?? "",
    salary: Number(src.salary ?? 0),
    salaryGrade: src.salaryGrade?.toString() ?? "",
    salaryStep: Number(src.salaryStep ?? 1),

    // ✅ THIS LINE MAKES THE SWITCH CORRECT ON EDIT
    salaryMode: src.salaryMode ?? "AUTO",
    birthday: src.birthday ? new Date(src.birthday) : undefined,
    dateHired: src.dateHired ? new Date(src.dateHired) : undefined,
    latestAppointment: src.latestAppointment ? new Date(src.latestAppointment) : undefined,
    terminateDate: src.terminateDate ?? "",
    isFeatured: !!src.isFeatured,
    isArchived: !!src.isArchived,
    isHead: !!src.isHead,
    memberPolicyNo: src.memberPolicyNo ?? "",
    age: src.age?.toString?.() ?? "",
    nickname: src.nickname ?? "",
    emergencyContactName: src.emergencyContactName ?? "",
    emergencyContactNumber: src.emergencyContactNumber ?? "",
    employeeLink: src.employeeLink ?? "",

    // ✅ add these four
    gsisNo: src.gsisNo ?? "",
    tinNo: src.tinNo ?? "",
    philHealthNo: src.philHealthNo ?? "",
    pagIbigNo: src.pagIbigNo ?? "",

    images: Array.isArray(src.images) && src.images.length > 0
      ? src.images.map((i: any) => ({ url: i.url }))
      : EMPTY_DEFAULTS.images,
    designationId: src.designationId ?? null,
    note: src.note ?? "",
  };
}



interface EmployeesFormProps {
  initialData: Employee & {
    images: Image[]
  } | null;
  offices: Offices[];
  eligibility: Eligibility[];
  employeeType: EmployeeType[];
  workSchedules: WorkScheduleDTO[];
  scheduleExceptions: ScheduleExceptionDTO[];
  weeklyExclusions: WeeklyExclusionDTO[];
}


export const EmployeesForm = ({
  initialData,
  offices,
  eligibility,
  employeeType,
  workSchedules,
  scheduleExceptions,
  weeklyExclusions,
}: EmployeesFormProps) => {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [inputSearchOpen, setInputSearchOpen] = useState(false);
  const [timelineVersion, setTimelineVersion] = useState(0);
  const [awardsVersion, setAwardsVersion] = useState(0);
  const [bioOptions, setBioOptions] = useState<BioSuggestion[]>([]);
  const [suggesting, setSuggesting] = useState(false);


  const [value, setValue] = useState("")



  // const fetchProvinces = async () => {
  //   try {
  //     if (selectedRegion) {
  //       const response = await axios.get(`/api/geo?action=provinces&regionId=${selectedRegion}`);
  //       setProvinces(response.data);
  //     }
  //   } catch (error) {
  //     console.error("Error fetching provinces", error);
  //   }
  // };

  const title = initialData ? "Edit Employee" : "Create Employee";
  const description = initialData ? "Edit a Employee" : "Add new Employee";
  const toastMessage = initialData ? "Employee updated." : "Employee created.";
  const action = initialData ? "Save changes" : "Create";


  const router = useRouter();
  const params = useParams() as { departmentId: string; employeesId?: string };
  const { departmentId, employeesId } = params;
  const key = employeesKey(params.departmentId);
  const { data: employee } = useEmployee(departmentId, employeesId);

  const employeeId =
    employeesId
    ?? employee?.id
    ?? initialData?.id
    ?? ""; //

  const initialDefaults = useMemo(
    () => (employee ? mapToDefaults(employee) : initialData ? mapToDefaults(initialData) : EMPTY_DEFAULTS),
    // only compute from SSR (initialData); SWR reset will run in useEffect below
    [initialData, employee] // safe; recomputes when SWR arrives
  );

  const form = useForm<EmployeesFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: initialDefaults,
  });

  useEffect(() => {
    form.reset(initialDefaults);
  }, [form, initialDefaults]);


  const [calculatedAge, setCalculatedAge] = useState(0);

  // Function to calculate age
  const calculateAgeFromBirthday = (birthday: Date) => {
    const today = new Date();
    const birthDate = new Date(birthday);
    const age = today.getFullYear() - birthDate.getFullYear();

    // Adjust age based on the birth month and day
    if (
      today.getMonth() < birthDate.getMonth() ||
      (today.getMonth() === birthDate.getMonth() && today.getDate() < birthDate.getDate())
    ) {
      return age;
    } else {
      return age;
    }
  };


  // split "2050000-0007, E-4" | "8540010, E-4" | "2050000-0007" | "8540010"
  function splitEmployeeNo(raw?: string | null) {
    const clean = (raw ?? "").trim();
    if (!clean) return { bio: "", emp: "" };

    // split by comma to separate EMP part if any
    const [left, right] = clean.split(",").map(s => s.trim());

    // left may be "2050000-0007" or "8540010"
    const bio = (left ?? "").toUpperCase();
    const emp = (right ?? "").toUpperCase();

    return { bio, emp };
  }

  // join back to the saved UI format "BIO, EMP" if EMP exists
  function joinEmployeeNo(bio: string, emp?: string) {
    const b = (bio ?? "").trim().toUpperCase();
    const e = (emp ?? "").trim().toUpperCase();
    return e ? `${b}, ${e}` : b;
  }
  const officeId = form.watch("officeId"); // keep

  const suggestBio = useCallback(async () => {
    if (suggesting) return;              // prevent double taps
    if (!officeId) { toast.error("Select an Office first."); return; }

    setSuggesting(true);
    const toastId = toast.loading("Suggesting…", {
      description: "Finding the next available BIO number.",
      duration: Infinity, // stays until dismissed
    });

    try {
      setBioOptions([]);
      const res = await fetch(`/api/${params.departmentId}/offices/${officeId}/suggest-bio`, { cache: "no-store" });
      const data = await res.json();

      if (!res.ok || !data?.ok) throw new Error(data?.message || "Failed to suggest an available BIO.");

      let suggestions: BioSuggestion[] = Array.isArray(data.suggestions)
        ? data.suggestions.filter((s: any) => s?.candidate).map((s: any) => ({ indexCode: String(s.indexCode ?? ""), candidate: String(s.candidate) }))
        : data.suggestion ? [{ indexCode: "", candidate: String(data.suggestion) }] : [];

      if (!suggestions.length) {
        toast.error("No available BIO found.");
        return;
      }

      if (suggestions.length === 1) {
        const suggested = suggestions[0].candidate.toUpperCase();
        const { emp } = splitEmployeeNo(form.getValues("employeeNo"));
        form.setValue("employeeNo", joinEmployeeNo(suggested, emp), { shouldDirty: true, shouldTouch: true, shouldValidate: true });
        toast.success(`Suggested BIO: ${suggested}`, { 
          id: toastId,
          duration: 3000,
        });
        return;
      }

      setBioOptions(suggestions);
      toast.success("Suggestion ready ✔", { id: toastId, duration: 3000  });
    } catch (e: any) {
      toast.error(e?.message ?? "Unable to suggest bio number.", { id: toastId, duration: 3000 });
    } finally {
      setSuggesting(false);
    }
  }, [officeId, params.departmentId, form, suggesting]);


  useEffect(() => { setBioOptions([]); }, [officeId]);
  const onInvalid = () => {
    toast.error("Please fill the required fields.", {
      description: "Check the highlighted inputs and try again.",
    });
  };
  const onSubmit = async (values: EmployeesFormValues) => {
      console.group("🚨 SUBMIT PAYLOAD");
  console.log("salaryMode:", values.salaryMode);
  console.log("salary:", values.salary);
  console.log("salaryGrade:", values.salaryGrade);
  console.log("salaryStep:", values.salaryStep);
  console.groupEnd();
    const contact = (values.contactNumber ?? "").trim();
    setLoading(true);

         const toastId = toast.loading("Processing...", {
    description: "Please wait while we save your data.",
  });

    try {
      const payload = {
        ...values,
        salaryGrade: String(values.salaryGrade ?? ""),
        salary: Number(values.salary ?? 0),
      };
      if (contact) payload.contactNumber = contact;
      // Call the API
      const res = initialData
        ? await axios.patch(`/api/${params.departmentId}/employees/${params.employeesId}`, payload)
        : await axios.post(`/api/${params.departmentId}/employees`, payload);

      const saved = res.data; // <-- return full employee from API

      // ✅ Optimistic update SWR cache (no page refresh)
      await globalMutate(
        key,
        (curr: any[] | undefined) => {
          const list = curr ?? [];
          if (initialData) {
            // replace edited row
            return list.map((e) => (e.id === saved.id ? { ...e, ...saved } : e));
          } else {
            // prepend new row
            return [saved, ...list];
          }
        },
        false // don't revalidate yet; instant UI update
      );

      // 🔄 Then revalidate to ensure perfect server state
      globalMutate(key);
      if (initialData && employeeId && typeof window !== "undefined") {
        sessionStorage.setItem("employee-updated", employeeId);
      }
      router.back();
      toast.success("Success!", { id: toastId, description: initialData ? "Employee updated." : "Employee created." });
    } catch (error: any) {
      toast.error("Uh oh! Something went wrong.", {
      id: toastId,
      description:
        error?.response?.data?.error ??
        "There was a problem with your request.",
    });
    } finally {
      setLoading(false);
    }
  };

  const onDelete = async () => {
    try {
      setLoading(true);

      await axios.delete(`/api/${params.departmentId}/employees/${params.employeesId}`);

      toast.success("Success!", {
        description: "Employee deleted.",
      });

      router.refresh();
      router.push(`/${params.departmentId}/employees`)


    } catch (error) {

      toast.success("Error!", {
        description: "Remove all users to proceed.",
      });

    } finally {
      setLoading(false);
    }
  }

  const currentYear = new Date().getFullYear();
  const fromYear = currentYear - 75;


  const genderOptions = Object.values(Gender);





  function formatNumber(input: string): string {
    const numericValue = input.replace(/\D/g, '');
    const groupSize = 3;
    const groups = numericValue.match(new RegExp(`\\d{1,${groupSize}}`, 'g'));
    return groups ? groups.join('-') : '';
  }


  const formatDate = (input: string) => {
    // Remove non-numeric characters
    const numericValue = input.replace(/\D/g, '');

    // Format the date as "mm/dd/yyyy"
    const formattedDate = numericValue
      .replace(/(\d{2})(\d{2})(\d{4})/, '$1/$2/$3') // Format as "mm/dd/yyyy"
      .substr(0, 10); // Limit to 10 characters (mm/dd/yyyy)

    return formattedDate;
  };


useEffect(() => {
  const sub = form.watch((values, { name }) => {
    if (name === "salaryGrade" && !values.salaryGrade) {
      form.setValue("salaryGrade", "1", { shouldDirty: true });
    }
  });
  return () => sub.unsubscribe();
}, [form]);

  return (
    <>
      <AlertModal
        isOpen={open}
        onClose={() => setOpen(false)}
        onConfirm={onDelete}
        loading={loading}
      />
      <div className="flex items-center justify-between">
        <Heading
          title={title}
          description={description}
        />
        {initialData && (
          <Button
            disabled={loading}
            variant="destructive"
            size="icon"
            onClick={() => setOpen(true)}
          >
            <Trash className="h-4 w-4" />
          </Button>
        )}
      </div >
       <Separator className="my-4" />
      < Form {...form} >
        <form onSubmit={form.handleSubmit(onSubmit, onInvalid)} className="space-y-8 w-full">



          <Tabs defaultValue="details" className="mt-8">
            <TabsList
              className="
    sticky top-0 z-30
    w-full 
    flex justify-start gap-2
    rounded-none border-b 
    bg-background/95 backdrop-blur
  "
            >
              <TabsTrigger
                value="details"
                className="
      flex-1
      data-[state=active]:bg-primary
      data-[state=active]:text-primary-foreground
      data-[state=active]:shadow-sm
    "
              >
                Employee Details
              </TabsTrigger>
              <TabsTrigger
                value="schedule"
                disabled={!employeeId}
                className="
      flex-1
      data-[state=active]:bg-primary
      data-[state=active]:text-primary-foreground
      data-[state=active]:shadow-sm
    "
              >
                Schedules
              </TabsTrigger>
              <TabsTrigger
                value="timeline"
                disabled={!employeeId}
                className="
      flex-1
      data-[state=active]:bg-primary 
      data-[state=active]:text-primary-foreground 
      data-[state=active]:shadow-sm
    "
              >
                Timeline
              </TabsTrigger>
              <TabsTrigger
                value="awards"
                disabled={!employeeId}
                className="
      flex-1 
      data-[state=active]:bg-primary 
      data-[state=active]:text-primary-foreground 
      data-[state=active]:shadow-sm
    "
              >
                Awards
              </TabsTrigger>
            </TabsList>


            <TabsContent value="details">
              <h1 className="font-sans text-4xl font-bold">Profile</h1>
              <FormField
                control={form.control}
                name="images"
                render={({ field }) => {
                  // watch the gender field from your form
                  const gender = form.watch("gender") as "Male" | "Female" | undefined;

                  return (
                    <FormItem>
                      <FormControl>
                        <ImageUpload
                          gender={gender} // ✅ pass gender here
                          value={field.value.map((image) => image.url)}
                          disabled={loading}
                          onChange={(url) =>
                            field.onChange([...field.value, { url }])
                          }
                          onRemove={(url) =>
                            field.onChange(
                              field.value.filter((current) => current.url !== url)
                            )
                          }
                        />
                      </FormControl>
                      <FormDescription>
                        Upload picture of an employee
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  );
                }}
              />
              <Separator className="my-4" />
              {/* Compact row: Employee No. + Suggest (left) | Office (right) */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="employeeNo"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Employee No. (e.g., 8540010, E-4)</FormLabel>

                      {/* Input + Button inline */}
                      <div className="flex gap-2">
                        <FormControl className="flex-1">
                          <Input
                            disabled={loading}
                            placeholder="e.g., 8540010, E-4"
                            {...field}
                            onChange={(e) => field.onChange(e.target.value.toUpperCase())}
                          />
                        </FormControl>

                        <Button
                          type="button"
                          onClick={suggestBio}
                          disabled={loading || suggesting || !officeId}
                          className="shrink-0 whitespace-nowrap"
                          variant="secondary"
                          aria-label="Suggest Bio Number"
                          aria-busy={suggesting}
                        >
                          {suggesting ? (
                            <span className="inline-flex items-center gap-2">
                              <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                              Suggesting…
                            </span>
                          ) : "Suggest Bio No."}
                        </Button>


                      </div>
                      {/* Render multiple suggestions as quick-pick buttons */}
                      {bioOptions.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-2">
                          {bioOptions.map((opt) => (
                            <Button
                              key={`${opt.indexCode}-${opt.candidate}`}
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                const { emp } = splitEmployeeNo(form.getValues("employeeNo"));
                                form.setValue("employeeNo", joinEmployeeNo(opt.candidate.toUpperCase(), emp), {
                                  shouldDirty: true,
                                  shouldTouch: true,
                                  shouldValidate: true,
                                });
                                // Optionally hide choices after selecting:
                                // setBioOptions([]);
                              }}
                              className="rounded-full"
                            >
                              Use {opt.candidate}
                            </Button>
                          ))}
                        </div>
                      )}

                      {/* keep description but hide on small screens to reduce height */}
                      <FormDescription className="hidden sm:block">
                        Enter “BIO, EMP” or click Suggest to auto-fill the BIO part.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="officeId"
                  render={({ field }) => (
                    <AutoField
                      kind="select"
                      label="Office"
                      field={field}
                      required
                      disabled={loading}
                      placeholder="Select Office"
                      recentKey="officeId"
                      recentMax={3}
                      recentLabel="Recently used"
                      pinSuggestions
                      options={[...offices]
                        .sort((a, b) => a.name.localeCompare(b.name))
                        .map((o) => ({ value: o.id, label: o.name }))}
                      description="Select the office where the employee is designated."
                      searchable
                      searchPlaceholder="Search office..."
                    />

                  )}
                />
              </div>

              <Separator className="my-4" />
              <div className="sm:grid sm:grid-1 md:grid-2 grid-cols-4 gap-8">
                <FormField
                  control={form.control}
                  name="prefix"
                  render={({ field }) => (
                    <AutoField
                      kind="datalist"
                      label="Prefix"
                      field={field}
                      staticOptions={PREFIX_OPTIONS}
                      priorityOptions={["HON.", "DR.", "ATTY."]}
                      pinSuggestions
                      placeholder="Select or type Prefix..."
                      formatMode="upper"
                      formatModes={["none", "upper", "title"]}
                      disabled={loading}
                    />
                  )}
                />

                <FormField
                  control={form.control}
                  name="nickname"
                  render={({ field }) => (
                    <AutoField
                      kind="text"
                      label="Nickname"
                      field={field}
                      required
                      placeholder="Nickname"
                      showCounter
                      formatMode="upper"           // Anne marie -> Anne Marie
                      normalizeWhitespace          // collapse extra spaces
                      nameSafe                     // block digits/symbols (keeps - and ')
                      autoFormatOnBlur
                      liveFormat        
                    />
                  )}
                />

                <FormField
                  control={form.control}
                  name="firstName"
                  render={({ field }) => (
                    <AutoField
                      kind="text"
                      label="First Name"
                      field={field}
                      required
                      placeholder="First Name"
                      description="Ex: Jon"
                      showCounter
                      formatMode="upper"           // Anne marie -> Anne Marie
                      normalizeWhitespace          // collapse extra spaces
                      nameSafe                     // block digits/symbols (keeps - and ')
                      autoFormatOnBlur
                      liveFormat        
                    />

                  )}
                />


                <FormField
                  control={form.control}
                  name="lastName"
                  render={({ field }) => (
                    <AutoField
                      kind="text"
                      label="Last Name"
                      field={field}
                      required
                      placeholder="Last Name"
                      description="Ex: Nifas"
                      showCounter
                      formatMode="upper"
                      normalizeWhitespace
                      nameSafe
                      autoFormatOnBlur
                    />
                  )}
                />
                <FormField
                  control={form.control}
                  name="middleName"
                  render={({ field }) => (
                    <AutoField
                      kind="text"
                      label="Middle Name"
                      field={field}
                      placeholder="Middle Name"
                      description="Ex: De Guzman"
                      showCounter
                      formatMode="upper"           // Anne marie -> Anne Marie
                      normalizeWhitespace          // collapse extra spaces
                      nameSafe                     // block digits/symbols (keeps - and ')
                      autoFormatOnBlur
                    />
                  )}
                />


                <FormField
                  control={form.control}
                  name="suffix"
                  render={({ field }) => (
                    <AutoField
                      kind="datalist"
                      label="Suffix"
                      field={field}
                      staticOptions={SUFFIX_OPTIONS}
                      priorityOptions={["JR.", "CPA", "RN"]}
                      pinSuggestions
                      placeholder="Select or type Suffix..."
                      formatMode="upper"
                      formatModes={["none", "upper", "title"]}
                      disabled={loading}
                    />
                  )}
                />

                <FormField
                  control={form.control}
                  name="position"
                  render={({ field }) => (
                    <AutoField
                      kind="datalist"
                      label="Position"
                      field={field}
                      endpoint="/api/autofill/positions" // full list (string[])
                      priorityEndpoint={`/api/autofill/popular?field=position&limit=2`}
                      pinSuggestions
                      pinnedLabel="Frequently used"
                      placeholder="Search or enter Position..."
                      showFormatSwitch
                      formatMode="none"
                      formatModes={["none", "upper", "title", "sentence"]}
                      disabled={loading}
                    />
                  )}
                />



                <FormField
                  control={form.control}
                  name="contactNumber"
                  render={({ field }) => (
                    <AutoField
                      kind="phone"
                      label="Contact Number"
                      field={field}
                      disabled={loading}
                    />
                  )}
                />


                <FormField
                  control={form.control}
                  name="birthday"
                  render={({ field }) => (
                    <AutoField
                      kind="date"
                      label="Date of birth"
                      field={field}
                      fromYear={currentYear - 100}
                      toYear={currentYear}
                      disableFuture
                      description="Your date of birth is used to calculate your age."
                      disabled={loading}
                      required
                    />
                  )}
                />
                {/* <FormField
        control={form.control}
        name="age"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Age</FormLabel>
            <FormControl>
              <Input
                disabled={loading}
            
                {...field}
              />
            </FormControl>
          </FormItem>
        )}
      /> */}
                <FormField
                  control={form.control}
                  name="gender"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Gender </FormLabel>
                      <span className="text-red-500 align-top">*</span>
                      <Select
                        disabled={loading}
                        onValueChange={field.onChange}
                        value={field.value}
                        defaultValue={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue
                              defaultValue={field.value}
                              placeholder="Select gender "
                            />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {genderOptions.map((item) => (
                            <SelectItem
                              key={item}
                              value={item}
                            >
                              {item}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />  <FormField
                  control={form.control}
                  name="education"
                  render={({ field }) => (
                    <AutoField
                      kind="datalist"
                      label="Education"
                      field={field}
                      endpoint="/api/autofill/educations"
                      priorityEndpoint={`/api/autofill/popular?field=education&limit=2`}
                      pinSuggestions
                      formatMode="title"
                      pinnedLabel="Suggestions"
                      placeholder="Search or enter Position..."
                    />
                  )}
                />

              </div>
              <Separator className="my-4" />
              <div className="grid lg:grid-cols-2 grid-cols-1 gap-4">
                {/* <FormField
              control={form.control}
              name="region"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Region</FormLabel>
                  <FormControl>
                    <Input
                      disabled={loading}
                      placeholder="Ilocos"
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    This Information is private
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            /> */}
                <FormField
                  control={form.control}
                  name="emergencyContactName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Emergency Contact Name</FormLabel>
                      <FormControl>
                        <Input
                          disabled={loading}
                          placeholder="Emergency Contact Name"
                          {...field}
                          onChange={(e) => {
                            // Convert the input value to uppercase
                            const uppercaseValue = e.target.value.toUpperCase();
                            // Set the field value to the uppercase value
                            field.onChange(uppercaseValue);
                          }}
                        />
                      </FormControl>
                      <FormDescription>
                        Contact when emergecy
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="emergencyContactNumber"
                  render={({ field }) => {
                    const display = formatPHPretty(field.value ?? ""); // pretty only
                    return (
                      <FormItem>
                        <FormLabel>Emergency Contact Number</FormLabel>
                        <FormControl>
                          <Input
                            type="text"
                            inputMode="numeric"
                            autoComplete="tel"
                            pattern={"^0\\d{10}$|^0\\d{3}-\\d{3}-\\d{4}$"}
                            value={display}
                            onChange={(e) => {
                              // Strip hyphens/spaces from UI, normalize + clamp, store raw (no hyphens)
                              const raw = normalizePHMobileLive(e.target.value);
                              // allow empty (optional field)
                              field.onChange(raw);
                            }}
                            onBlur={(e) => {
                              // Re-run normalize (handles paste cases cleanly)
                              const raw = normalizePHMobileLive(e.target.value);
                              field.onChange(raw);
                            }}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    );
                  }}
                />

                <FormField
                  control={form.control}
                  name="houseNo"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Unit/Number</FormLabel>
                      <FormControl>
                        <Input
                          disabled={loading}
                          placeholder="Home Number"
                          {...field}
                        />
                      </FormControl>
                      <FormDescription>
                        This is optional
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="street"
                  render={({ field }) => (
                    <AutoField
                      kind="datalist"
                      label="Street"
                      field={field}
                      endpoint="/api/autofill/streets"
                      priorityEndpoint={`/api/autofill/popular?field=street&limit=3`}
                      pinSuggestions
                      pinnedLabel="Suggestions"
                      placeholder="Search or enter Street..."

                    />
                  )}
                />

                <FormField
                  control={form.control}
                  name="barangay"
                  render={({ field }) => (
                    <AutoField
                      kind="datalist"
                      label="Barangay"
                      field={field}
                      endpoint="/api/autofill/barangays"
                      priorityEndpoint={`/api/autofill/popular?field=barangay&limit=2`}
                      pinSuggestions
                      pinnedLabel="Suggestions"
                      placeholder="Search or enter Barangay..."
                      formatMode="upper"
                    />
                  )}
                />
                <FormField
                  control={form.control}
                  name="city"
                  render={({ field }) => (
                    <AutoField
                      kind="datalist"
                      label="City"
                      field={field}
                      endpoint="/api/autofill/cities"
                      placeholder="Search or enter City..."
                      formatMode="upper"
                      priorityEndpoint={`/api/autofill/popular?field=city&limit=2`}
                      pinSuggestions
                      pinnedLabel="Suggestions"
                    />
                  )}
                />

                <FormField
                  control={form.control}
                  name="province"
                  render={({ field }) => (
                    <AutoField
                      kind="datalist"
                      label="Province"
                      field={field}
                      endpoint="/api/autofill/provinces"
                      placeholder="Search or enter Province..."
                      formatMode="upper"
                      priorityEndpoint={`/api/autofill/popular?field=province&limit=2`}
                      pinSuggestions
                      pinnedLabel="Suggestions"
                    />
                  )}
                />
              </div>

              <Separator className="my-4" />

              <div className="grid lg:grid-cols-2 grid-cols-1 gap-4">
                <SalaryInput form={form} loading={loading} maxStep={8} />
                <FormField
                  control={form.control}
                  name="designationId"
                  render={({ field }) => (
                    <AutoField
                      kind="select"
                      label="Plantilla Designation"
                      field={field}
                      placeholder="Choose office…"
                      optionsEndpoint={`/api/offices?departmentId=${params.departmentId}`}
                      recentKey="designationId"
                      recentMax={3}
                      recentLabel="Recently used"
                      pinSuggestions
                      disabled={loading}
                      description="Plantilla office record."
                      required={false}
                      searchable
                      searchPlaceholder="Search office..."
                    />
                  )}
                />


                <FormField
                  control={form.control}
                  name="employeeTypeId"
                  render={({ field }) => (
                    <AutoField
                      kind="select"
                      label="Appointment"
                      field={field}
                      required
                      disabled={loading}
                      placeholder="Select Appointment"
                      options={employeeType
                        .slice()
                        .sort((a, b) => a.name.localeCompare(b.name))
                        .map(et => ({ value: et.id, label: et.name }))}

                      searchable
                      searchPlaceholder="Search appointment..."
                      description="Select an Appointment for the employee"
                    />

                  )}
                />
                <FormField
                  control={form.control}
                  name="eligibilityId"
                  render={({ field }) => (
                    <AutoField
                      kind="select"
                      label="Eligibility"
                      field={field}
                      required
                      disabled={loading}
                      placeholder="Select Eligibility"
                      recentKey="eligibilityId"
                      recentMax={3}
                      recentLabel="Recently used"
                      priorityEndpoint={`/api/autofill/popular?field=eligibility&limit=3`}
                      pinSuggestions
                      pinnedLabel="Suggestions"
                      options={eligibility
                        .slice()
                        .sort((a, b) => a.name.localeCompare(b.name))
                        .map(el => ({ value: el.id, label: el.name }))}
                      searchable
                      searchPlaceholder="Search eligibility..."
                    />

                  )}
                />

                <FormField
                  control={form.control}
                  name="dateHired"
                  render={({ field }) => (
                    <AutoField
                      kind="date"
                      label="Date hired"
                      placeholder="MM-DD-YYYY"
                      field={field}                 // ✅ pass RHF field
                      fromYear={fromYear}           // e.g. currentYear - 75
                      toYear={currentYear}
                     
                      disabled={loading}
                      required
                    />
                  )}
                />


              </div>
             <Separator className="my-4" />
              <div className="grid lg:grid-cols-2 grid-cols-1 gap-8">
                <FormField
                  control={form.control}
                  name="gsisNo"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>GSIS Number</FormLabel>
                      <FormControl>
                        <Input
                          disabled={loading}
                          placeholder="000-000-000-0"
                          {...field}
                          onChange={(e) => {
                            const inputValue = e.target.value;
                            if (inputValue.length <= 12) {
                              // If the input length is 10 or less, update the field value
                              const formattedValue = formatNumber(inputValue);
                              field.onChange(formattedValue);
                            }
                            // If input length exceeds 10 characters, do not update the field value
                          }}
                        />

                      </FormControl>
                      <FormDescription>
                        {field.value && field.value.length !== 13 && <span className="text-red-600">GSIS number must be 10 characters long.</span>}
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="tinNo"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>TIN Number</FormLabel>
                      <FormControl>
                        <Input
                          disabled={loading}
                          placeholder="000-000-000"
                          {...field}
                          onChange={(e) => {
                            const inputValue = e.target.value;
                            if (inputValue.length <= 11) {
                              const formattedValue = formatNumber(inputValue);
                              field.onChange(formattedValue);
                            }
                          }}

                        />

                      </FormControl>
                      <FormDescription>
                        {field.value && field.value.length !== 11 && <span className="text-red-600">TIN number must be 9 characters long.</span>}
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="philHealthNo"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Philhealth Number</FormLabel>
                      <FormControl>
                        <Input
                          disabled={loading}
                          placeholder="000-000-000-000"
                          {...field}
                          onChange={(e) => {
                            const inputValue = e.target.value;
                            if (inputValue.length <= 15) {
                              const formattedValue = formatNumber(inputValue);
                              field.onChange(formattedValue);
                            }
                          }}
                        />
                      </FormControl>
                      <FormDescription>
                        {field.value && field.value.length !== 15 && <span className="text-red-600">TIN number must be 12 characters long.</span>}
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="memberPolicyNo"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Member Policy Number</FormLabel>
                      <FormControl>
                        <Input
                          disabled={loading}
                          placeholder="Member Policy Number"
                          {...field}
                          onChange={(e) => {
                            const inputValue = e.target.value;
                            if (inputValue.length <= 13) {
                              field.onChange(inputValue);
                            }
                          }}
                        />
                      </FormControl>
                      <FormDescription>
                        {field.value && field.value.length !== 13 && <span className="text-red-600">Member Policy number must be 13 characters long.</span>}
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="pagIbigNo"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Pagibig Number</FormLabel>
                      <FormControl>
                        <Input
                          disabled={loading}
                          placeholder="000-000-000-000"
                          {...field}

                          onChange={(e) => {
                            const inputValue = e.target.value;
                            if (inputValue.length <= 15) {
                              const formattedValue = formatNumber(inputValue);
                              field.onChange(formattedValue);
                            }
                          }}
                        />

                      </FormControl>
                      <FormDescription>
                        {field.value && field.value.length !== 15 && <span className="text-red-600">Pagibig Policy number must be 12 characters long.</span>}
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="latestAppointment"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel>Latest Appointment</FormLabel>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            className={cn(
                              "w-auto justify-start text-left font-normal",
                              !field.value && "text-muted-foreground"
                            )}
                          >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {field.value ? format(new Date(field.value), "PPP") : <span>Pick a date</span>}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent align="start" className="w-auto p-0">
                          <Calendar
                            mode="single"
                            captionLayout="dropdown-buttons"
                            selected={field.value ? new Date(field.value) : undefined}
                            onSelect={(date) => field.onChange(date?.toISOString() ?? undefined)}
                            fromYear={fromYear}
                            toYear={currentYear}
                          />
                        </PopoverContent>
                      </Popover>
                      <FormDescription>
                        This field is optional for employees with the most recent appointment.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />


                <FormField
                  control={form.control}
                  name="employeeLink"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Employee&rsquo;s File</FormLabel>
                      <FormControl>
                        <Input
                          disabled={loading}
                          placeholder="https:// "
                          {...field}
                        />
                      </FormControl>
                      <FormDescription>
                        Please provide the URL link to the employee&rsquo;s file. Ensure it is accessible and correctly formatted (if applicable).
                      </FormDescription>
                      <FormMessage>
                        {field.value && !/^https?:\/\/[^\s/$.?#].[^\s]*$/.test(field.value) && (
                          <span className="text-red-600">Please provide a valid URL.</span>
                        )}
                      </FormMessage>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="terminateDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Termination Date </FormLabel>
                      <FormControl>
                        <Input
                          disabled={loading}
                          placeholder="mm/dd/yyyy"
                          {...field}
                          onChange={(e) => {
                            const formattedValue = formatDate(e.target.value);
                            field.onChange(formattedValue);
                          }}
                        />
                      </FormControl>
                      <FormDescription>
                        This field is optional for employee is terminated/retired.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />


                <FormField
                  control={form.control}
                  name="note"
                  render={({ field }) => (
                    <AutoField
                      kind="textarea"
                      label="Notes"
                      field={field}
                      placeholder="Enter any remarks, assignments, or special notes…"
                      rows={5}
                      maxLength={1000}
                      showCounter
                      disabled={loading}
                    />
                  )}
                />

              </div>

              <div className="grid lg:grid-cols-2  grid-cols-1 gap-8  space-y-0 ">
                <FormField
                  control={form.control}
                  name='isHead'
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                      <FormControl>
                        <Checkbox
                          checked={field.value}
                          //@ts-ignore
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                      <div className="space-y-1 leading-none">
                        <FormLabel>Is this employee in Executive Level Position?</FormLabel>
                        <FormDescription>
                          Marking this option will ensure that this employee always appears at the top.
                        </FormDescription>
                      </div>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name='isFeatured'
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                      <FormControl>
                        <Checkbox
                          checked={field.value}
                          //@ts-ignore
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                      <div className="space-y-1 leading-none">
                        <FormLabel>Is featured employee?</FormLabel>
                        <FormDescription>
                          This employee will apear on home page
                        </FormDescription>
                      </div>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name='isArchived'
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                      <FormControl>
                        <Checkbox
                          checked={field.value}
                          //@ts-ignore
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                      <div className="space-y-1 leading-none">
                        <FormLabel>Archived employee?</FormLabel>
                        <FormDescription>
                          This employee will not appear anywhere
                        </FormDescription>
                      </div>
                    </FormItem>
                  )}
                />
              </div>
              <Separator className="my-4" />
              <Button disabled={loading} className=" mt-2" type="submit">
                {action}
              </Button>

            </TabsContent>

            <TabsContent value="schedule">
              {employeeId ? (
                <EmployeeScheduleManager
                  employeeId={employeeId}
                  schedules={workSchedules}
                  exceptions={scheduleExceptions}
                  weeklyExclusions={weeklyExclusions}
                />
              ) : (
                <p className="mt-4 text-sm text-muted-foreground">
                  Save the employee profile to configure work schedules.
                </p>
              )}
            </TabsContent>

            <TabsContent value="timeline">
              <div className="text-sm text-muted-foreground p-2 ">
                Fill out the Timeline.
              </div>
              {employeeId ? (
                <>
                  <AddTimelineEvent
                    employeeId={employeeId}
                    onSaved={() => setTimelineVersion(v => v + 1)}      // ✅ bump
                    onDeleted={() => setTimelineVersion(v => v + 1)}    // ✅ bump
                  />
                  <div className="mt-6">
                    <Timeline employeeId={employeeId} version={timelineVersion} />
                  </div>
                </>
              ) : (
                <div className="rounded-lg border p-4 text-sm text-muted-foreground">
                  Save the employee first to enable Timeline.
                </div>
              )}
            </TabsContent>

            <TabsContent value="awards">
              <div className="text-sm text-muted-foreground p-2 ">
                Fill out the Awards / Recognition.
              </div>
              {employeeId ? (
                <>
                  <AddAward
                    employeeId={employeeId}
                    onSaved={() => setAwardsVersion(v => v + 1)}        // ✅ bump
                    onDeleted={() => setAwardsVersion(v => v + 1)}      // ✅ bump
                  />
                  <div className="mt-6">
                    <AwardsGallery employeeId={employeeId} version={awardsVersion} />
                  </div>
                </>
              ) : (
                <div className="rounded-lg border p-4 text-sm text-muted-foreground">
                  Save the employee first to enable Awards.
                </div>
              )}
            </TabsContent>
          </Tabs>


           <Separator className="my-4" />


        </form>
      </Form>

    </>
  );
}
